import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import zlib from 'node:zlib';

export const name = 'session-manager';
export const inject = ['webServer', 'sessions', 'agents'];

const BASE = '/session-manager';
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));
const ZSTD_MAGIC = 0xfd2fb528;

/** Fast in-memory summary cache keyed by sessionId -> { rev, summary } */
const SESSION_SUMMARY_MEMO = new Map();

function respondJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(body);
}

async function readJsonBody(req, maxBytes = 8 * 1024 * 1024) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > maxBytes)
            throw new Error('请求体过大（超过 8MB 限制）');
        chunks.push(buf);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
}

/** Multi-frame Zstd scanner & decoder fallback for cold logs. */
function decodeMultiFrameZstd(buffer) {
    const outChunks = [];
    let offset = 0;
    while (offset < buffer.length) {
        if (buffer.length - offset < 4)
            break;
        if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
            throw new Error(`Invalid Zstd frame magic at byte ${offset}`);
        }
        let pos = offset + 4;
        const descriptor = buffer.readUInt8(pos++);
        const contentSizeFlag = descriptor >>> 6;
        const singleSegment = (descriptor & 32) !== 0;
        const checksum = (descriptor & 4) !== 0;
        const dictFlag = descriptor & 3;
        const dictBytes = dictFlag === 3 ? 4 : dictFlag;
        const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : (1 << contentSizeFlag);
        pos += (singleSegment ? 0 : 1) + dictBytes + contentSizeBytes;
        for (;;) {
            if (pos + 3 > buffer.length)
                throw new Error('Truncated Zstd block header');
            const blockHeader = buffer.readUIntLE(pos, 3);
            pos += 3;
            const lastBlock = (blockHeader & 1) !== 0;
            const blockType = (blockHeader >>> 1) & 3;
            const blockSize = blockHeader >>> 3;
            pos += blockType === 1 ? 1 : blockSize;
            if (lastBlock)
                break;
        }
        if (checksum)
            pos += 4;
        outChunks.push(zlib.zstdDecompressSync(buffer.subarray(offset, pos)));
        offset = pos;
    }
    return Buffer.concat(outChunks).toString('utf8');
}

function encodeZstdFrameFallback(text) {
    return zlib.zstdCompressSync(Buffer.from(text, 'utf8'), {
        params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 },
    });
}

function resolveDataPaths(ctx) {
    const persistence = ctx.get?.('sessionPersistence');
    const sessionsRoot = persistence?.root
        ? resolve(String(persistence.root))
        : resolve(process.cwd(), 'data', 'dsh', 'sessions');
    const dshDataRoot = dirname(sessionsRoot);
    return {
        sessionsRoot,
        dshDataRoot,
        projCacheDir: join(dshDataRoot, 'storages', 'session_projcache', 'sessions'),
        attachmentsRoot: join(dshDataRoot, 'attachments', 'v1'),
        presetEnhanceStateFile: join(dshDataRoot, 'preset-enhance', 'state.json'),
    };
}

function findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId) {
    const sessionDirs = [];
    const logFiles = [];
    let totalBytes = 0;
    let primaryMtimeMs = 0;

    if (existsSync(sessionsRoot)) {
        for (const projEnt of readdirSync(sessionsRoot, { withFileTypes: true })) {
            if (!projEnt.isDirectory())
                continue;
            const candidateDir = join(sessionsRoot, projEnt.name, sessionId);
            if (existsSync(candidateDir)) {
                sessionDirs.push(candidateDir);
                try {
                    for (const f of readdirSync(candidateDir)) {
                        const fp = join(candidateDir, f);
                        const st = statSync(fp);
                        if (st.isFile()) {
                            totalBytes += st.size;
                            if (f.includes('.jsonl')) {
                                logFiles.push(fp);
                                if (!primaryMtimeMs)
                                    primaryMtimeMs = st.mtimeMs;
                            }
                        }
                    }
                } catch { /* ignore */ }
            }
        }
    }

    const projCacheFile = join(projCacheDir, `${sessionId}.json`);
    const hasProjCache = existsSync(projCacheFile);
    if (hasProjCache) {
        try { totalBytes += statSync(projCacheFile).size; } catch { /* ignore */ }
    }

    return {
        sessionDirs,
        logFiles,
        primaryLogFile: logFiles[0] ?? null,
        primaryMtimeMs,
        projCacheFile: hasProjCache ? projCacheFile : null,
        totalBytes,
    };
}

function collectAttachmentIdsFromEvents(events) {
    const ids = new Set();
    const visit = (val) => {
        if (!val || typeof val !== 'object')
            return;
        if (Array.isArray(val)) {
            for (const item of val)
                visit(item);
            return;
        }
        if (typeof val.attachmentId === 'string' && /^[a-f0-9]{64}$/i.test(val.attachmentId)) {
            ids.add(val.attachmentId.toLowerCase());
        }
        for (const v of Object.values(val)) {
            if (v && typeof v === 'object')
                visit(v);
        }
    };
    visit(events);
    return ids;
}

async function readFullSessionLog(ctx, sessionId) {
    const live = ctx.sessions?.get?.(sessionId);
    if (live) {
        try { await ctx.sessions.flush(live); } catch { /* best-effort */ }
    }
    const query = ctx.get?.('sessionQuery');
    if (query?.readSession) {
        try {
            const res = await query.readSession(sessionId);
            return {
                header: res.session,
                inheritedEventCount: res.inheritedEventCount ?? 0,
                events: res.events ?? [],
            };
        } catch { /* fallback to direct disk decode */ }
    }

    const persistence = ctx.get?.('sessionPersistence');
    if (persistence?.open) {
        let handle;
        try {
            handle = await persistence.open(sessionId, 'read');
            const events = await handle.read(0, Number.MAX_SAFE_INTEGER);
            return {
                header: structuredClone(handle.header),
                inheritedEventCount: handle.header?.seedLength ?? 0,
                events: structuredClone(events),
            };
        } catch { /* fallback to raw file */ }
        finally {
            try { await handle?.close?.(); } catch { /* ignore */ }
        }
    }

    const { sessionsRoot, projCacheDir } = resolveDataPaths(ctx);
    const disk = findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId);
    if (!disk.primaryLogFile) {
        throw new Error(`找不到会话 ${sessionId} 的日志文件`);
    }
    const rawBuf = await readFile(disk.primaryLogFile);
    const decoded = disk.primaryLogFile.endsWith('.zstd')
        ? decodeMultiFrameZstd(rawBuf)
        : rawBuf.toString('utf8');
    const lines = decoded.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0)
        throw new Error(`会话文件为空: ${disk.primaryLogFile}`);
    const headerLine = JSON.parse(lines[0]);
    const { type: _t, inheritedEventCount = 0, ...header } = headerLine;
    const events = lines.slice(1).map(l => JSON.parse(l));
    return { header, inheritedEventCount, events };
}

async function unloadLiveSession(ctx, sessionId) {
    const persistence = ctx.get?.('sessionPersistence');
    const agentsSvc = ctx.get?.('agents');
    const liveAgent = agentsSvc?.get?.(sessionId);
    const liveSession = ctx.sessions?.get?.(sessionId);
    const wasLive = Boolean(liveAgent || liveSession);

    if (liveAgent) {
        try {
            if (liveAgent.status === 'running') {
                liveAgent.cancel({ kind: 'disposed' });
                await liveAgent.whenIdle?.();
            }
        } catch { /* ignore */ }
    }
    if (liveSession) {
        try { await ctx.sessions.flush(liveSession); } catch { /* ignore */ }
    }

    // Explicitly drain & close the active JSONL write handle so Windows SessionWriteLease is released
    const tracker = persistence?.tracker;
    const writer = tracker?.writers?.get?.(sessionId);
    if (writer) {
        try { await writer.drainLive?.(); } catch { /* ignore */ }
        try { await writer.flush?.(); } catch { /* ignore */ }
        try { await writer.close?.(); } catch { /* ignore */ }
    }
    if (tracker?.pending?.has?.(sessionId)) {
        try { tracker.pending.delete(sessionId); } catch { /* ignore */ }
        try { tracker.writers?.delete?.(sessionId); } catch { /* ignore */ }
    }

    if (liveAgent) {
        try { await liveAgent.scope?.dispose?.(); } catch { /* ignore */ }
    }

    // Detach from AgentRegistry and SessionStore so in-memory stores do not retain stale state or throw "already exists"
    const agentEntry = agentsSvc?.store?.get?.(sessionId);
    if (agentEntry) {
        try {
            if (typeof agentsSvc.detachEntered === 'function')
                agentsSvc.detachEntered(agentEntry);
            else
                agentsSvc.store.delete(sessionId);
        } catch {
            try { agentsSvc.store?.delete?.(sessionId); } catch { /* ignore */ }
        }
    }

    const sessEntry = ctx.sessions?.store?.get?.(sessionId);
    if (sessEntry) {
        try {
            if (typeof sessEntry.detach === 'function')
                sessEntry.detach();
            else if (typeof ctx.sessions.detachEntered === 'function')
                ctx.sessions.detachEntered(sessEntry);
            else
                ctx.sessions.store.delete(sessionId);
        } catch {
            try { ctx.sessions.store?.delete?.(sessionId); } catch { /* ignore */ }
        }
    }

    for (let attempt = 0; attempt < 25; attempt++) {
        const stillAgent = agentsSvc?.get?.(sessionId);
        const stillSession = ctx.sessions?.get?.(sessionId);
        const stillWriter = tracker?.writers?.get?.(sessionId);
        const stillPending = persistence?.hasPendingSession?.(sessionId);
        if (!stillAgent && !stillSession && !stillWriter && !stillPending)
            break;
        await new Promise(r => setTimeout(r, 40));
    }
    return wasLive;
}

function isRealUserMessageEvent(ev) {
    if (ev?.type !== 'user/message')
        return false;
    const kind = ev.data?.source?.kind ?? 'user';
    if (kind !== 'user')
        return false;
    const firstText = ev.data?.content?.find?.(b => b?.type === 'text')?.text ?? '';
    if (firstText.startsWith('<system-reminder>') || firstText.startsWith('Time sampled while preparing turn ')) {
        return false;
    }
    return true;
}

function extractTitleFromEvents(header, events) {
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev?.type === 'session/title' && typeof ev.data?.title === 'string' && ev.data.title.trim()) {
            return ev.data.title.trim();
        }
    }
    for (const ev of events) {
        if (isRealUserMessageEvent(ev) && Array.isArray(ev.data?.content)) {
            const txt = ev.data.content.filter(b => b?.type === 'text').map(b => b.text).join(' ').trim();
            if (txt)
                return txt.slice(0, 60) + (txt.length > 60 ? '…' : '');
        }
    }
    return '';
}

function buildStructuredConversation(header, events) {
    const turns = [];
    let currentTurn = null;

    for (const ev of events) {
        if (ev.type === 'turn/start') {
            currentTurn = {
                turn: ev.data?.turn ?? (turns.length + 1),
                startSeq: ev.seq,
                endSeq: ev.seq,
                status: 'open',
                errorReason: '',
                time: ev.time,
                items: [],
                toolCallsCount: 0,
            };
            turns.push(currentTurn);
            continue;
        }

        if (ev.type === 'turn/end') {
            if (currentTurn && currentTurn.turn === ev.data?.turn) {
                currentTurn.endSeq = ev.seq;
                currentTurn.status = ev.data?.reason?.kind ?? 'completed';
                if (ev.data?.reason?.error?.message) {
                    currentTurn.errorReason = String(ev.data.reason.error.message).slice(0, 200);
                }
            }
            currentTurn = null;
            continue;
        }

        if (!currentTurn)
            continue;
        currentTurn.endSeq = ev.seq;

        if (ev.type === 'user/message') {
            if (!isRealUserMessageEvent(ev))
                continue;
            const blocks = (ev.data?.content ?? []).map((b, idx) => ({
                blockIndex: idx,
                type: b?.type ?? 'unknown',
                text: typeof b?.text === 'string' ? b.text : '',
                editable: b?.type === 'text',
            }));
            currentTurn.items.push({
                role: 'user',
                sourceKind: 'user',
                eventSeq: ev.seq,
                time: ev.time,
                blocks,
            });
        } else if (ev.type === 'assistant/message') {
            const content = ev.data?.message?.content ?? [];
            const blocks = [];
            let toolUsesInMsg = 0;
            content.forEach((b, idx) => {
                if (b?.type === 'reasoning' || b?.type === 'text') {
                    blocks.push({
                        blockIndex: idx,
                        type: b.type,
                        text: typeof b.text === 'string' ? b.text : '',
                        editable: true,
                    });
                } else if (b?.type === 'tool-call' || b?.type === 'tool_use' || b?.type === 'toolCall') {
                    toolUsesInMsg++;
                    currentTurn.toolCallsCount++;
                    blocks.push({
                        blockIndex: idx,
                        type: 'tool_use',
                        toolName: b.name ?? b.toolName ?? 'tool',
                        editable: false,
                    });
                }
            });
            if (blocks.length > 0 || toolUsesInMsg > 0) {
                currentTurn.items.push({
                    role: 'assistant',
                    model: ev.data?.message?.source?.model ?? '',
                    provider: ev.data?.message?.source?.provider ?? '',
                    eventSeq: ev.seq,
                    time: ev.time,
                    blocks,
                });
            }
        }
    }

    return {
        title: extractTitleFromEvents(header, events),
        totalEvents: events.length,
        turns,
    };
}

function computeValidInheritedEventCount(header, prevInheritedCount, events) {
    if (!header?.isSeeded)
        return 0;
    let lastInheritedMarkerIdx = -1;
    for (let i = 0; i < events.length; i++) {
        if (events[i]?.type === 'session/end-seed' && events[i]?.data?.inherited === true) {
            lastInheritedMarkerIdx = i;
        }
    }
    if (lastInheritedMarkerIdx >= 0)
        return lastInheritedMarkerIdx;
    return Math.min(prevInheritedCount ?? 0, events.length);
}

function ensureInheritedCutBeforeAppend(header, prevInheritedCount, events, now = Date.now()) {
    if (!header?.isSeeded)
        return;
    const hasInheritedMarker = events.some(e => e?.type === 'session/end-seed' && e?.data?.inherited === true);
    if (!hasInheritedMarker && (prevInheritedCount ?? 0) === events.length) {
        events.push({
            type: 'session/end-seed',
            seq: events.length,
            time: now,
            data: { inherited: true },
        });
    }
}

async function commitRewrittenSessionInPlace(ctx, sessionId, header, inheritedEventCount, newEvents, resumeAfter = false) {
    const persistence = ctx.get?.('sessionPersistence');
    const projCache = ctx.get?.('sessionProjectionCache');
    const { sessionsRoot, projCacheDir, presetEnhanceStateFile } = resolveDataPaths(ctx);

    const safeInherited = computeValidInheritedEventCount(header, inheritedEventCount, newEvents);
    const cleanHeader = structuredClone(header);
    delete cleanHeader.seedLength;

    // 1. Validate against BOTH DSH's Session.create (snapshot) and Session.fromRestore (detached disk restore)
    // using an isolated temporary ID so a live store entry never causes `session "..." already exists`!
    if (ctx.sessions?.prepare) {
        const validateId1 = `__sm_val_snap_${randomUUID()}`;
        ctx.sessions.prepare(validateId1, {
            seed: structuredClone(newEvents),
            meta: { ...structuredClone(cleanHeader), id: validateId1 },
            inheritedEventCount: safeInherited,
        });
        const validateId2 = `__sm_val_rest_${randomUUID()}`;
        ctx.sessions.prepare(validateId2, {
            seed: structuredClone(newEvents),
            meta: { ...structuredClone(cleanHeader), id: validateId2 },
            inheritedEventCount: safeInherited,
            eventState: 'detached',
        });
    }

    // 2. Encode into official multi-frame Zstd (or plain JSONL if configured)
    let encodedBytes;
    if (typeof persistence?.encodeMaterialization === 'function') {
        const raw = await persistence.encodeMaterialization(cleanHeader, safeInherited, newEvents);
        encodedBytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
    } else {
        const headerObj = {
            type: 'session',
            ...cleanHeader,
            ...(cleanHeader.isSeeded ? { inheritedEventCount: safeInherited } : {}),
        };
        const headerLine = JSON.stringify(headerObj) + '\n';
        if (newEvents.length === 0) {
            encodedBytes = encodeZstdFrameFallback(headerLine);
        } else {
            const bodyLines = newEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
            encodedBytes = Buffer.concat([
                encodeZstdFrameFallback(headerLine),
                encodeZstdFrameFallback(bodyLines),
            ]);
        }
    }

    // 3. Locate target file on disk
    const disk = findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId);
    let targetFile = disk.primaryLogFile;
    if (!targetFile && typeof persistence?.locate === 'function') {
        const loc = persistence.locate(cleanHeader);
        if (loc?.path)
            targetFile = loc.path;
    }
    if (!targetFile) {
        throw new Error(`无法定位会话 ${sessionId} 的物理存储路径`);
    }

    await mkdir(dirname(targetFile), { recursive: true });
    const tmpFile = `${targetFile}.sm-tmp-${randomUUID()}`;
    const fh = await open(tmpFile, 'w');
    try {
        await fh.writeFile(encodedBytes);
        await fh.sync();
    } finally {
        await fh.close();
    }
    await rename(tmpFile, targetFile);

    // 4. Purge all stale caches
    SESSION_SUMMARY_MEMO.delete(sessionId);
    try { persistence?.coldLogMemo?.delete?.(sessionId); } catch { /* ignore */ }
    try { await projCache?.requireTable?.()?.delete?.(sessionId); } catch { /* ignore */ }
    const projFile = join(projCacheDir, `${sessionId}.json`);
    if (existsSync(projFile)) {
        await rm(projFile, { force: true }).catch(() => {});
    }
    try {
        const obs = ctx.get?.('sessionQuery')?._observations;
        if (obs?.entries instanceof Map)
            obs.entries.delete(sessionId);
    } catch { /* ignore */ }

    if (existsSync(presetEnhanceStateFile)) {
        try {
            const rawState = JSON.parse(await readFile(presetEnhanceStateFile, 'utf8'));
            if (rawState?.sessions && Object.hasOwn(rawState.sessions, sessionId)) {
                delete rawState.sessions[sessionId];
                rawState.revision = (rawState.revision || 0) + 1;
                const tmpPreset = `${presetEnhanceStateFile}.sm-tmp-${randomUUID()}`;
                await writeFile(tmpPreset, JSON.stringify(rawState, null, 2), 'utf8');
                await rename(tmpPreset, presetEnhanceStateFile);
            }
        } catch { /* ignore */ }
    }

    // 5. Re-index header in workspaceRegistry & optionally resume live agent
    const workspaceRegistry = ctx.get?.('workspaceRegistry');
    try { await workspaceRegistry?.indexHeader?.(cleanHeader); } catch { /* ignore */ }

    if (resumeAfter) {
        const resumed = await ctx.get?.('sessionController')?.resolveAgent?.(sessionId);
        if (resumed && typeof resumed === 'object' && 'error' in resumed && resumed.error) {
            throw resumed.error instanceof Error ? resumed.error : new Error(String(resumed.error));
        }
    }
}

/**
 * Remove selected turns AND their paired pre-turn `agent/inbox/spliced` insertions,
 * then re-sequence `seq = 0..N-1` and `turn = 1..K` cleanly so DSH Session replay stays 100% valid.
 */
function removeTurnsAndResequence(events, turnsToRemoveSet) {
    const dropSeqs = new Set();
    let activeTurn = null;
    let pendingPreTurnInboxSeqs = [];

    for (const ev of events) {
        if (activeTurn === null && ev.type === 'agent/inbox/spliced') {
            pendingPreTurnInboxSeqs.push(ev.seq);
            continue;
        }
        if (ev.type === 'turn/start') {
            activeTurn = ev.data?.turn;
            if (turnsToRemoveSet.has(activeTurn)) {
                for (const s of pendingPreTurnInboxSeqs)
                    dropSeqs.add(s);
                dropSeqs.add(ev.seq);
            }
            pendingPreTurnInboxSeqs = [];
            continue;
        }
        if (activeTurn !== null) {
            if (turnsToRemoveSet.has(activeTurn))
                dropSeqs.add(ev.seq);
            if (ev.type === 'turn/end' && ev.data?.turn === activeTurn) {
                activeTurn = null;
            }
            continue;
        }
        // Any non-inbox global config event outside a turn (e.g. model/selection) stays intact
    }

    const oldToNewSeq = new Map();
    const keptRaw = [];
    for (const ev of events) {
        if (dropSeqs.has(ev.seq))
            continue;
        if (ev.type === 'session/title-llm-request' && Array.isArray(ev.data?.messageSeqs) && ev.data.messageSeqs.some(s => dropSeqs.has(s))) {
            continue;
        }
        oldToNewSeq.set(ev.seq, keptRaw.length);
        keptRaw.push(structuredClone(ev));
    }

    const oldToNewTurn = new Map();
    let nextTurnNum = 1;
    for (const ev of keptRaw) {
        if (ev.type === 'turn/start' && typeof ev.data?.turn === 'number') {
            if (!oldToNewTurn.has(ev.data.turn)) {
                oldToNewTurn.set(ev.data.turn, nextTurnNum++);
            }
        }
    }

    return keptRaw.map((ev, newSeq) => {
        ev.seq = newSeq;
        if (ev.data && typeof ev.data === 'object') {
            if (typeof ev.data.turn === 'number' && oldToNewTurn.has(ev.data.turn)) {
                ev.data.turn = oldToNewTurn.get(ev.data.turn);
            }
            if (Array.isArray(ev.data.messageSeqs)) {
                ev.data.messageSeqs = ev.data.messageSeqs
                    .filter(s => oldToNewSeq.has(s))
                    .map(s => oldToNewSeq.get(s));
            }
        }
        if (Array.isArray(ev.sourceEventSeqs)) {
            ev.sourceEventSeqs = ev.sourceEventSeqs
                .filter(s => oldToNewSeq.has(s))
                .map(s => oldToNewSeq.get(s));
        }
        return ev;
    });
}

async function permanentlyDeleteSessions(ctx, sessionIds) {
    const uniqueIds = [...new Set(sessionIds.map(s => String(s ?? '').trim()).filter(Boolean))];
    if (uniqueIds.length === 0)
        return { deletedCount: 0, freedBytes: 0, details: [] };

    const persistence = ctx.get?.('sessionPersistence');
    const projCache = ctx.get?.('sessionProjectionCache');
    const workspaceRegistry = ctx.get?.('workspaceRegistry');
    const { sessionsRoot, projCacheDir, attachmentsRoot, presetEnhanceStateFile } = resolveDataPaths(ctx);

    const candidateAttachmentIds = new Set();
    const details = [];
    let totalFreedBytes = 0;

    for (const sessionId of uniqueIds) {
        try {
            const loaded = await readFullSessionLog(ctx, sessionId);
            for (const aid of collectAttachmentIdsFromEvents(loaded.events)) {
                candidateAttachmentIds.add(aid);
            }
        } catch { /* ignore */ }

        await unloadLiveSession(ctx, sessionId);

        if (workspaceRegistry) {
            try { await workspaceRegistry.unpinSession?.(sessionId); } catch { /* ignore */ }
            try { await workspaceRegistry.unarchiveSession?.(sessionId); } catch { /* ignore */ }
            for (const ws of workspaceRegistry.list?.() ?? []) {
                if (ws.sessionIds?.includes?.(sessionId)) {
                    try { await ws.detachSession(sessionId); } catch { /* ignore */ }
                }
            }
            try { workspaceRegistry.headers?.delete?.(sessionId); } catch { /* ignore */ }
        }

        const disk = findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId);
        const removedPaths = [];
        for (const dir of disk.sessionDirs) {
            await rm(dir, { recursive: true, force: true });
            removedPaths.push(dir);
            const parentDir = dirname(dir);
            try {
                if (existsSync(parentDir) && readdirSync(parentDir).length === 0) {
                    await rm(parentDir, { recursive: true, force: true });
                }
            } catch { /* ignore */ }
        }

        if (disk.projCacheFile && existsSync(disk.projCacheFile)) {
            await rm(disk.projCacheFile, { force: true }).catch(() => {});
            removedPaths.push(disk.projCacheFile);
        }

        SESSION_SUMMARY_MEMO.delete(sessionId);
        try { persistence?.coldLogMemo?.delete?.(sessionId); } catch { /* ignore */ }
        try { await projCache?.requireTable?.()?.delete?.(sessionId); } catch { /* ignore */ }
        try {
            const obs = ctx.get?.('sessionQuery')?._observations;
            if (obs?.entries instanceof Map)
                obs.entries.delete(sessionId);
        } catch { /* ignore */ }
        try { ctx.emit?.('api-session/removed', sessionId); } catch { /* ignore */ }

        totalFreedBytes += disk.totalBytes;
        details.push({
            sessionId,
            freedBytes: disk.totalBytes,
            removedPaths,
        });
    }

    const removedAttachments = [];
    if (candidateAttachmentIds.size > 0 && existsSync(attachmentsRoot)) {
        const stillReferenced = new Set();
        if (existsSync(sessionsRoot)) {
            for (const projEnt of readdirSync(sessionsRoot, { withFileTypes: true })) {
                if (!projEnt.isDirectory())
                    continue;
                const pDir = join(sessionsRoot, projEnt.name);
                for (const sEnt of readdirSync(pDir, { withFileTypes: true })) {
                    if (!sEnt.isDirectory())
                        continue;
                    try {
                        const logInfo = await readFullSessionLog(ctx, sEnt.name);
                        for (const aid of collectAttachmentIdsFromEvents(logInfo.events)) {
                            if (candidateAttachmentIds.has(aid))
                                stillReferenced.add(aid);
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        for (const aid of candidateAttachmentIds) {
            if (stillReferenced.has(aid))
                continue;
            const shard = aid.slice(0, 2);
            for (const subPath of [
                join(attachmentsRoot, 'file-objects', shard, aid),
                join(attachmentsRoot, 'files', shard, aid),
            ]) {
                if (existsSync(subPath)) {
                    try {
                        const st = statSync(subPath);
                        if (st.isFile())
                            totalFreedBytes += st.size;
                        else if (st.isDirectory()) {
                            for (const f of readdirSync(subPath)) {
                                try { totalFreedBytes += statSync(join(subPath, f)).size; } catch { /* ignore */ }
                            }
                        }
                        await rm(subPath, { recursive: true, force: true });
                        removedAttachments.push(subPath);
                    } catch { /* ignore */ }
                }
            }
        }
    }

    if (existsSync(presetEnhanceStateFile)) {
        try {
            const rawState = JSON.parse(await readFile(presetEnhanceStateFile, 'utf8'));
            let mutated = false;
            for (const sid of uniqueIds) {
                if (rawState?.bindings && Object.hasOwn(rawState.bindings, sid)) {
                    delete rawState.bindings[sid];
                    mutated = true;
                }
                if (rawState?.sessions && Object.hasOwn(rawState.sessions, sid)) {
                    delete rawState.sessions[sid];
                    mutated = true;
                }
            }
            if (mutated) {
                rawState.revision = (rawState.revision || 0) + 1;
                const tmpPreset = `${presetEnhanceStateFile}.sm-del-${randomUUID()}`;
                await writeFile(tmpPreset, JSON.stringify(rawState, null, 2), 'utf8');
                await rename(tmpPreset, presetEnhanceStateFile);
            }
        } catch { /* ignore */ }
    }

    return {
        deletedCount: uniqueIds.length,
        freedBytes: totalFreedBytes,
        removedAttachments,
        details,
    };
}

async function listAllSessionsSummary(ctx) {
    const workspaceRegistry = ctx.get?.('workspaceRegistry');
    const sessionTitleSvc = ctx.get?.('sessionTitle');
    const sessionQuery = ctx.get?.('sessionQuery');
    const agentsSvc = ctx.get?.('agents');
    const { sessionsRoot, projCacheDir } = resolveDataPaths(ctx);

    const workspaceBySession = new Map();
    const workspaces = [];
    const archivedSet = new Set(workspaceRegistry?.archivedSessionIds ?? []);
    const pinnedSet = new Set(workspaceRegistry?.pinnedSessionIds ?? []);

    for (const ws of workspaceRegistry?.list?.() ?? []) {
        const wsInfo = {
            id: String(ws.id),
            title: ws.title || ws.path || String(ws.id),
            path: ws.path || '',
            sessionCount: ws.sessionIds?.length ?? 0,
        };
        workspaces.push(wsInfo);
        for (const sid of ws.sessionIds ?? []) {
            workspaceBySession.set(String(sid), wsInfo);
        }
    }

    const allIds = new Set([...workspaceBySession.keys()]);
    if (existsSync(sessionsRoot)) {
        for (const projEnt of readdirSync(sessionsRoot, { withFileTypes: true })) {
            if (!projEnt.isDirectory())
                continue;
            const pDir = join(sessionsRoot, projEnt.name);
            for (const sEnt of readdirSync(pDir, { withFileTypes: true })) {
                if (sEnt.isDirectory())
                    allIds.add(sEnt.name);
            }
        }
    }
    for (const live of ctx.sessions?.list?.() ?? []) {
        if (live?.id)
            allIds.add(String(live.id));
    }

    let titleMap = new Map();
    if (sessionQuery?.readTitleSnapshots) {
        try {
            titleMap = await sessionQuery.readTitleSnapshots([...allIds]);
        } catch { /* ignore */ }
    }

    const items = [];
    for (const sessionId of allIds) {
        const liveSession = ctx.sessions?.get?.(sessionId);
        const liveAgent = agentsSvc?.get?.(sessionId);
        const disk = findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId);
        const ws = workspaceBySession.get(sessionId) ?? null;

        let header = liveSession?.header ?? null;
        let turnCount = 0;
        let eventCount = 0;
        let title = '';
        let updatedAt = disk.primaryMtimeMs || 0;

        const memoRev = `${disk.primaryMtimeMs}:${disk.totalBytes}`;
        const cached = !liveSession ? SESSION_SUMMARY_MEMO.get(sessionId) : null;

        if (liveSession) {
            const evs = liveSession.snapshotEvents?.() ?? liveSession.events ?? [];
            eventCount = evs.length;
            turnCount = evs.filter(e => e.type === 'turn/start').length;
            title = sessionTitleSvc?.get?.(liveSession)?.title ?? extractTitleFromEvents(header, evs);
            updatedAt = evs.at(-1)?.time ?? header?.createdAt ?? updatedAt;
        } else if (cached && cached.rev === memoRev) {
            header = cached.header;
            eventCount = cached.eventCount;
            turnCount = cached.turnCount;
            title = titleMap.get?.(sessionId)?.title || cached.title;
            updatedAt = cached.updatedAt;
        } else {
            const snapTitle = titleMap.get?.(sessionId)?.title;
            if (disk.primaryLogFile) {
                try {
                    const full = await readFullSessionLog(ctx, sessionId);
                    header = full.header;
                    eventCount = full.events.length;
                    turnCount = full.events.filter(e => e.type === 'turn/start').length;
                    title = snapTitle || extractTitleFromEvents(full.header, full.events);
                    updatedAt = full.events.at(-1)?.time || updatedAt || full.header?.createdAt || 0;
                    SESSION_SUMMARY_MEMO.set(sessionId, {
                        rev: memoRev,
                        header,
                        eventCount,
                        turnCount,
                        title,
                        updatedAt,
                    });
                } catch {
                    title = snapTitle || '（日志待修复或空会话）';
                }
            }
        }

        items.push({
            sessionId,
            title: title || '（未命名空会话）',
            workspaceId: ws?.id ?? '__orphan__',
            workspaceTitle: ws?.title ?? '未归属孤儿会话',
            cwd: header?.cwd ?? ws?.path ?? '',
            agentPreset: header?.agentPreset ?? '',
            createdAt: header?.createdAt ?? 0,
            updatedAt,
            turnCount,
            eventCount,
            totalBytes: disk.totalBytes,
            primaryLogFile: disk.primaryLogFile,
            hasProjCache: Boolean(disk.projCacheFile),
            isLive: Boolean(liveSession),
            isRunning: liveAgent?.status === 'running',
            isArchived: archivedSet.has(sessionId),
            isPinned: pinnedSet.has(sessionId),
            isOrphan: ws === null,
        });
    }

    items.sort((a, b) => (b.isPinned - a.isPinned) || ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));

    return {
        workspaces,
        totalSessions: items.length,
        totalBytes: items.reduce((acc, s) => acc + s.totalBytes, 0),
        emptyCount: items.filter(s => s.turnCount === 0).length,
        orphanCount: items.filter(s => s.isOrphan).length,
        sessions: items,
    };
}

export function apply(ctx) {
    const staticAssets = new Map([
        ['', ['web/index.html', 'text/html; charset=utf-8']],
        ['/', ['web/index.html', 'text/html; charset=utf-8']],
        ['/app.js', ['web/app.js', 'text/javascript; charset=utf-8']],
        ['/app.css', ['web/app.css', 'text/css; charset=utf-8']],
    ]);

    const handler = async (req, res) => {
        try {
            const urlObj = new URL(String(req.url ?? BASE), 'http://session-manager.local');
            const subPath = urlObj.pathname.startsWith(BASE)
                ? urlObj.pathname.slice(BASE.length)
                : urlObj.pathname;

            if (req.method === 'GET' && staticAssets.has(subPath)) {
                const [relFile, contentType] = staticAssets.get(subPath);
                const content = await readFile(join(PLUGIN_DIR, relFile));
                res.writeHead(200, {
                    'content-type': contentType,
                    'cache-control': 'no-store',
                });
                res.end(content);
                return;
            }

            if (req.method === 'GET' && subPath === '/api/sessions') {
                const summary = await listAllSessionsSummary(ctx);
                respondJson(res, 200, summary);
                return;
            }

            if (req.method === 'GET' && subPath === '/api/session') {
                const sessionId = (urlObj.searchParams.get('sessionId') ?? '').trim();
                if (!sessionId)
                    return respondJson(res, 400, { error: '缺少 sessionId 参数' });
                const { sessionsRoot, projCacheDir } = resolveDataPaths(ctx);
                const disk = findSessionDiskArtifacts(sessionsRoot, projCacheDir, sessionId);
                const full = await readFullSessionLog(ctx, sessionId);
                const structured = buildStructuredConversation(full.header, full.events);
                const attachments = [...collectAttachmentIdsFromEvents(full.events)];
                respondJson(res, 200, {
                    sessionId,
                    header: full.header,
                    inheritedEventCount: full.inheritedEventCount,
                    disk,
                    attachments,
                    ...structured,
                });
                return;
            }

            if (req.method === 'POST' && subPath === '/api/rename') {
                const body = await readJsonBody(req);
                const sessionId = String(body.sessionId ?? '').trim();
                const title = String(body.title ?? '').trim();
                if (!sessionId || !title)
                    return respondJson(res, 400, { error: '请提供有效的 sessionId 和新标题' });

                const liveSession = ctx.sessions?.get?.(sessionId);
                const titleSvc = ctx.get?.('sessionTitle');
                if (liveSession && titleSvc?.rename) {
                    titleSvc.rename(liveSession, title);
                    await ctx.sessions.flush(liveSession);
                    SESSION_SUMMARY_MEMO.delete(sessionId);
                    return respondJson(res, 200, { ok: true, sessionId, title });
                }

                const full = await readFullSessionLog(ctx, sessionId);
                const wasLive = await unloadLiveSession(ctx, sessionId);
                const newEvents = structuredClone(full.events);
                const now = Date.now();
                ensureInheritedCutBeforeAppend(full.header, full.inheritedEventCount, newEvents, now);
                newEvents.push({
                    type: 'session/title',
                    seq: newEvents.length,
                    time: now,
                    data: {
                        title,
                        messageSeqs: [],
                        source: { kind: 'user' },
                    },
                });
                await commitRewrittenSessionInPlace(ctx, sessionId, full.header, full.inheritedEventCount, newEvents, wasLive);
                return respondJson(res, 200, { ok: true, sessionId, title });
            }

            if (req.method === 'POST' && subPath === '/api/edit-message') {
                const body = await readJsonBody(req);
                const sessionId = String(body.sessionId ?? '').trim();
                const eventSeq = Number(body.eventSeq);
                const blockIndex = Number(body.blockIndex);
                const newText = typeof body.text === 'string' ? body.text : '';
                if (!sessionId || !Number.isInteger(eventSeq) || !Number.isInteger(blockIndex)) {
                    return respondJson(res, 400, { error: '参数不完整：需要 sessionId、eventSeq、blockIndex 与 text' });
                }

                const full = await readFullSessionLog(ctx, sessionId);
                const wasLive = await unloadLiveSession(ctx, sessionId);
                const newEvents = structuredClone(full.events);
                const targetEv = newEvents.find(e => e.seq === eventSeq);
                if (!targetEv) {
                    return respondJson(res, 404, { error: `未找到序号 seq=${eventSeq} 的消息事件` });
                }

                if (targetEv.type === 'user/message') {
                    const block = targetEv.data?.content?.[blockIndex];
                    if (!block || block.type !== 'text')
                        return respondJson(res, 400, { error: '目标用户消息块不是可编辑文本' });
                    block.text = newText;
                } else if (targetEv.type === 'assistant/message') {
                    const block = targetEv.data?.message?.content?.[blockIndex];
                    if (!block || (block.type !== 'text' && block.type !== 'reasoning'))
                        return respondJson(res, 400, { error: '目标助手消息块不是文本或思考块' });
                    block.text = newText;
                    if (Array.isArray(targetEv.data.stream)) {
                        targetEv.data.stream = [];
                    }
                } else {
                    return respondJson(res, 400, { error: `事件类型 ${targetEv.type} 不支持直接编辑文本` });
                }

                await commitRewrittenSessionInPlace(ctx, sessionId, full.header, full.inheritedEventCount, newEvents, wasLive);
                return respondJson(res, 200, { ok: true, sessionId, eventSeq, blockIndex });
            }

            if (req.method === 'POST' && subPath === '/api/delete-turns') {
                const body = await readJsonBody(req);
                const sessionId = String(body.sessionId ?? '').trim();
                const turns = Array.isArray(body.turns) ? body.turns.map(Number).filter(Number.isInteger) : [];
                if (!sessionId || turns.length === 0) {
                    return respondJson(res, 400, { error: '请指定要移除的回合编号' });
                }

                const full = await readFullSessionLog(ctx, sessionId);
                const wasLive = await unloadLiveSession(ctx, sessionId);
                const resequenced = removeTurnsAndResequence(full.events, new Set(turns));
                await commitRewrittenSessionInPlace(ctx, sessionId, full.header, full.inheritedEventCount, resequenced, wasLive);
                return respondJson(res, 200, {
                    ok: true,
                    sessionId,
                    removedTurns: turns,
                    remainingEvents: resequenced.length,
                });
            }

            if (req.method === 'POST' && subPath === '/api/append-turn') {
                const body = await readJsonBody(req);
                const sessionId = String(body.sessionId ?? '').trim();
                const userText = String(body.userText ?? '').trim();
                const assistantText = String(body.assistantText ?? '').trim();
                const reasoningText = String(body.reasoningText ?? '').trim();
                if (!sessionId || !userText || !assistantText) {
                    return respondJson(res, 400, { error: '追加对话轮次需要填写用户内容与助手回复内容' });
                }

                const full = await readFullSessionLog(ctx, sessionId);
                const wasLive = await unloadLiveSession(ctx, sessionId);
                const newEvents = structuredClone(full.events);
                const now = Date.now();
                ensureInheritedCutBeforeAppend(full.header, full.inheritedEventCount, newEvents, now);
                const existingMaxTurn = newEvents.reduce((m, e) => e.type === 'turn/start' ? Math.max(m, e.data?.turn ?? 0) : m, 0);
                const nextTurn = existingMaxTurn + 1;
                const lastModelEv = [...newEvents].reverse().find(e => e.type === 'assistant/message');
                const provider = lastModelEv?.data?.message?.source?.provider ?? 'vertex-direct';
                const model = lastModelEv?.data?.message?.source?.model ?? 'gemini-4-carbon';

                const pushEv = (type, data, extra = {}) => {
                    newEvents.push({ type, seq: newEvents.length, time: now, data, ...extra });
                };

                pushEv('turn/start', { turn: nextTurn });
                pushEv('user/message', {
                    id: randomUUID(),
                    role: 'user',
                    content: [{ type: 'text', text: userText }],
                    source: { kind: 'user' },
                }, { surfaceOp: 'append' });
                pushEv('step/start', { turn: nextTurn, step: 1 });
                const assistantBlocks = [];
                if (reasoningText)
                    assistantBlocks.push({ type: 'reasoning', text: reasoningText });
                assistantBlocks.push({ type: 'text', text: assistantText });
                pushEv('assistant/message', {
                    turn: nextTurn,
                    step: 1,
                    stream: [],
                    message: {
                        id: randomUUID(),
                        role: 'assistant',
                        content: assistantBlocks,
                        source: { kind: 'model', provider, model },
                    },
                }, { surfaceOp: 'append' });
                pushEv('step/end', { turn: nextTurn, step: 1 });
                pushEv('turn/end', { turn: nextTurn, reason: { kind: 'completed' } });

                await commitRewrittenSessionInPlace(ctx, sessionId, full.header, full.inheritedEventCount, newEvents, wasLive);
                return respondJson(res, 200, { ok: true, sessionId, turn: nextTurn });
            }

            if (req.method === 'POST' && subPath === '/api/delete-sessions') {
                const body = await readJsonBody(req);
                const sessionIds = Array.isArray(body.sessionIds) ? body.sessionIds : [];
                if (sessionIds.length === 0)
                    return respondJson(res, 400, { error: '请至少选择一个要彻底删除的会话' });

                const result = await permanentlyDeleteSessions(ctx, sessionIds);
                return respondJson(res, 200, { ok: true, ...result });
            }

            respondJson(res, 404, { error: `未知接口路径: ${subPath}` });
        } catch (error) {
            respondJson(res, 500, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };

    ctx.effect(
        () => ctx.webServer.register({ kind: 'prefix', path: BASE, handler }),
        'session-manager: web routes'
    );
}

export {
    decodeMultiFrameZstd,
    encodeZstdFrameFallback,
    removeTurnsAndResequence,
    collectAttachmentIdsFromEvents,
    computeValidInheritedEventCount,
    ensureInheritedCutBeforeAppend,
};
export default { name, inject, apply };
