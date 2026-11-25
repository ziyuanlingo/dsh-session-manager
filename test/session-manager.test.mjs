import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeMultiFrameZstd,
  encodeZstdFrameFallback,
  removeTurnsAndResequence,
  collectAttachmentIdsFromEvents,
  computeValidInheritedEventCount,
  ensureInheritedCutBeforeAppend,
} from '../index.mjs';

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

  // When a freshly forked session has all events inherited (no end-seed marker yet) and we append:
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
