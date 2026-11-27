import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeMultiFrameZstd,
  encodeZstdFrameFallback,
  buildStructuredConversation,
  removeTurnsAndResequence,
  collectAttachmentIdsFromEvents,
  computeValidInheritedEventCount,
  ensureInheritedCutBeforeAppend,
} from '../index.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('multi-frame Zstandard encoder & decoder roundtrip', () => {
  const frame1 = encodeZstdFrameFallback('{"type":"session","version":4,"id":"s1"}\n');
  const frame2 = encodeZstdFrameFallback('{"type":"turn/start","seq":0,"data":{"turn":1}}\n');
  const frame3 = encodeZstdFrameFallback('{"type":"turn/end","seq":1,"data":{"turn":1,"reason":{"kind":"completed"}}}\n');
  const concatenated = Buffer.concat([frame1, frame2, frame3]);

  const decoded = decodeMultiFrameZstd(concatenated);
  const lines = decoded.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[0]).id, 's1');
  assert.equal(JSON.parse(lines[2]).type, 'turn/end');
});

test('removeTurnsAndResequence removes paired inbox splices and renumbers turns & seqs contiguously', () => {
  const events = [
    { type: 'permission/preset', seq: 0, time: 1, data: { preset: 'workspace-write' } },
    // Turn 1 pre-turn inbox + body
    { type: 'agent/inbox/spliced', seq: 1, time: 2, data: { target: 'next-turn', start: 0, inserted: [{}] } },
    { type: 'turn/start', seq: 2, time: 3, data: { turn: 1 } },
    { type: 'agent/inbox/spliced', seq: 3, time: 4, data: { target: 'next-turn', start: 0, removedCount: 1, inserted: [] } },
    { type: 'user/message', seq: 4, time: 5, data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'bad turn' }], source: { kind: 'user' } }, surfaceOp: 'append' },
    { type: 'turn/end', seq: 5, time: 6, data: { turn: 1, reason: { kind: 'error' } } },
    // Turn 2 pre-turn inbox + body
    { type: 'agent/inbox/spliced', seq: 6, time: 7, data: { target: 'next-turn', start: 0, inserted: [{}] } },
    { type: 'turn/start', seq: 7, time: 8, data: { turn: 2 } },
    { type: 'agent/inbox/spliced', seq: 8, time: 9, data: { target: 'next-turn', start: 0, removedCount: 1, inserted: [] } },
    { type: 'user/message', seq: 9, time: 10, data: { id: 'u2', role: 'user', content: [{ type: 'text', text: 'good turn' }], source: { kind: 'user' } }, surfaceOp: 'append' },
    { type: 'session/title', seq: 10, time: 11, data: { title: 'good turn', messageSeqs: [9], source: { kind: 'fallback' } } },
    { type: 'turn/end', seq: 11, time: 12, data: { turn: 2, reason: { kind: 'completed' } } },
  ];

  const out = removeTurnsAndResequence(events, new Set([1]));
  assert.equal(out.length, 7);
  out.forEach((ev, idx) => assert.equal(ev.seq, idx));
  const turnStart = out.find(e => e.type === 'turn/start');
  const turnEnd = out.find(e => e.type === 'turn/end');
  const titleEv = out.find(e => e.type === 'session/title');
  const userEv = out.find(e => e.type === 'user/message');
  assert.equal(turnStart.data.turn, 1);
  assert.equal(turnEnd.data.turn, 1);
  assert.deepEqual(titleEv.data.messageSeqs, [userEv.seq]);
});

test('collectAttachmentIdsFromEvents extracts 64-hex SHA256 attachment references', () => {
  const sampleSha = 'fead5218315232d677d5e6ea796804e70e7cca51114088379583f23ab4c4e681';
  const ids = collectAttachmentIdsFromEvents([
    { type: 'user/message', data: { content: [{ type: 'image', attachment: { attachmentId: sampleSha } }] } },
  ]);
  assert.equal(ids.has(sampleSha), true);
  assert.equal(ids.size, 1);
});

test('computeValidInheritedEventCount & ensureInheritedCutBeforeAppend preserve isSeeded invariants', () => {
  const seededHeader = { version: 4, id: 's-fork', isSeeded: true };
  const eventsWithTurnAndCut = [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    { type: 'turn/end', seq: 1, time: 2, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'session/end-seed', seq: 2, time: 3, data: { inherited: true } },
    { type: 'agent-preset/selected', seq: 3, time: 4, data: { presetId: 'default' } },
  ];

  const trimmed = removeTurnsAndResequence(eventsWithTurnAndCut, new Set([1]));
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[0].type, 'session/end-seed');
  assert.equal(computeValidInheritedEventCount(seededHeader, 2, trimmed), 0);

  const pureSeededEvents = [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    { type: 'turn/end', seq: 1, time: 2, data: { turn: 1, reason: { kind: 'completed' } } },
  ];
  ensureInheritedCutBeforeAppend(seededHeader, 2, pureSeededEvents, 99);
  assert.equal(pureSeededEvents.length, 3);
  assert.equal(pureSeededEvents[2].type, 'session/end-seed');
  assert.deepEqual(pureSeededEvents[2].data, { inherited: true });
  assert.equal(computeValidInheritedEventCount(seededHeader, 2, pureSeededEvents), 2);
});

test('buildStructuredConversation normalizes reasoning and thinking blocks across multi-turn tool sessions', () => {
  const header = { version: 4, id: 's-multi', title: 'Multi-turn test' };
  const events = [
    { type: 'turn/start', seq: 0, time: 10, data: { turn: 1 } },
    { type: 'user/message', seq: 1, time: 11, data: { content: [{ type: 'text', text: 'turn 1 prompt' }] } },
    {
      type: 'assistant/message',
      seq: 2,
      time: 12,
      data: {
        model: 'test-model',
        message: {
          content: [
            { type: 'reasoning', text: 'turn 1 reasoning' },
            { type: 'text', text: 'turn 1 reply' },
          ],
        },
      },
    },
    { type: 'turn/end', seq: 3, time: 13, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 4, time: 20, data: { turn: 2 } },
    { type: 'user/message', seq: 5, time: 21, data: { content: [{ type: 'text', text: 'turn 2 prompt' }] } },
    {
      type: 'assistant/message',
      seq: 6,
      time: 22,
      data: {
        model: 'vertex/very-long-model-name-stream',
        message: {
          content: [
            { type: 'thinking', thinking: 'turn 2 native thinking block' },
            { type: 'tool-call', toolName: 'read_file' },
            { type: 'text', text: '' },
          ],
        },
      },
    },
    {
      type: 'assistant/message',
      seq: 7,
      time: 23,
      data: {
        model: 'vertex/very-long-model-name-stream',
        message: {
          content: [
            { type: 'thinking', text: 'turn 2 text-field thinking' },
            { type: 'text', text: 'turn 2 final answer' },
          ],
        },
      },
    },
    { type: 'turn/end', seq: 8, time: 24, data: { turn: 2, reason: { kind: 'completed' } } },
  ];

  const conv = buildStructuredConversation(header, events);
  assert.equal(conv.turns.length, 2);

  const turn2 = conv.turns[1];
  assert.equal(turn2.turn, 2);
  assert.equal(turn2.toolCallsCount, 1);
  assert.equal(turn2.items.length, 3);

  const step1Blocks = turn2.items[1].blocks;
  assert.equal(step1Blocks[0].type, 'reasoning');
  assert.equal(step1Blocks[0].rawType, 'thinking');
  assert.equal(step1Blocks[0].text, 'turn 2 native thinking block');
  assert.equal(step1Blocks[0].editable, true);
  assert.equal(step1Blocks[1].type, 'tool_use');
  assert.equal(step1Blocks[1].toolName, 'read_file');
  assert.equal(step1Blocks[2].type, 'text');
  assert.equal(step1Blocks[2].editable, true);

  const step2Blocks = turn2.items[2].blocks;
  assert.equal(step2Blocks[0].type, 'reasoning');
  assert.equal(step2Blocks[0].rawType, 'thinking');
  assert.equal(step2Blocks[0].text, 'turn 2 text-field thinking');
  assert.equal(step2Blocks[1].type, 'text');
  assert.equal(step2Blocks[1].text, 'turn 2 final answer');
});

test('Web UI defaults to English and ships real-time EN | 中文 | 日本語 switcher (v1.0.3)', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const html = readFileSync(join(REPO_ROOT, 'web', 'index.html'), 'utf8');
  const appJs = readFileSync(join(REPO_ROOT, 'web', 'app.js'), 'utf8');
  const clientJs = readFileSync(join(REPO_ROOT, 'client.js'), 'utf8');

  assert.equal(pkg.version, '1.0.3');
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('data-lang="en"') && html.includes('data-lang="zh-CN"') && html.includes('data-lang="ja"'));
  assert.ok(appJs.includes('en:') && appJs.includes("'zh-CN':") && appJs.includes('ja:'));
  assert.ok(clientJs.includes('Session Editor') && clientJs.includes('セッション管理'));
});
