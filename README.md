# 🗂️ dsh-session-manager

**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

**In-Place Session Editor, Turn Trimmer & True Physical Storage Cleaner for DeepSeek Harness (DSH `v0.2.x` / `v4` Zstd Logs)**

[![Version](https://img.shields.io/badge/Version-v1.0.3-ec6aa0.svg)](https://github.com/ziyuanlingo/dsh-session-manager/releases/tag/v1.0.3)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![DSH Compatibility](https://img.shields.io/badge/DSH-%3E%3D0.1.0--0%20%3C1.0.0-ff69b4.svg)](https://github.com/ziyuanlingo/dsh-session-manager)

---

## Overview

In multi-turn translation workbenches and long-running Agent workflows on DeepSeek Harness (DSH `0.2.x`), the default persistence layer only supports append-only events and logical archiving, leaving two persistent pain points:
1. **No physical deletion of sessions or disk artifacts**: Archiving merely hides sidebar entries while multi-frame Zstandard logs (`session.v4.jsonl.zstd` under `data/dsh/sessions/`), projection snapshots (`session_projcache`), and unreferenced uploaded attachments continue accumulating on disk.
2. **Branch-cloning editors pollute the workspace**: Legacy third-party editors either break on DSH `0.2.1+` due to removed internal frontend stores or clone a brand-new session ID on every single typo fix, rapidly cluttering the sidebar with redundant branches.

**`dsh-session-manager` (`v1.0.3`)** provides **100% lossless in-place session rewriting** and **six-stage true physical storage cleanup** with zero external runtime dependencies (powered by Node.js 22+ native Zstandard compression and dual DSH `Session.prepare` contract verification), complete with a **real-time trilingual (`EN | 中文 | 日本語`) Web Workbench** mounted in both the main sidebar and per-conversation tabs.

---

## Key Features

### 1. 🗑️ Six-Stage True Physical Deletion (Single / Batch / One-Click 0-Turn Purge)
When deleting sessions, the plugin executes a deterministic cleanup pipeline:
1. **Graceful Unload & Lease Release**: Cancels running turns if live, drains and closes active `JsonlSessionHandle` writers (releasing Windows/POSIX `SessionWriteLease` file locks), and detaches entries from `agents` and `sessions` stores.
2. **Real-Time Sidebar Detachment**: Detaches the session from `workspaceRegistry` workspaces, removes Pin/Archive flags, and triggers live UI synchronization.
3. **Physical Log Directory Removal**: Deletes `data/dsh/sessions/<workspace-slug>/<sessionId>/` and its `session.v4.jsonl.zstd` multi-frame compressed logs (pruning empty parent directories automatically).
4. **Projection & Observation Cache Purge**: Removes `data/dsh/storages/session_projcache/sessions/<sessionId>.json` along with in-memory projection tables, `coldLogMemo`, and `sessionQuery` observation caches.
5. **Orphaned Attachment Garbage Collection**: Scans SHA-256 attachment IDs referenced by deleted sessions, cross-checks all remaining sessions, and physically deletes unreferenced blobs under `data/dsh/attachments/v1/`.
6. **Preset Binding Cleanup**: Cleans up stale `bindings[sessionId]` and `sessions[sessionId]` entries in `dsh-preset-enhance` `state.json` when present.

### 2. ✏️ Lossless In-Place Session Editing (Zero Duplicate Clones)
All mutations update the **existing session ID** directly in place while preserving workspace placement, tool context, and preset bindings:
- **Edit Any Message or Reasoning Block**: Modify `user/message`, `assistant.reasoning` / `assistant.thinking` (preserving original `.thinking` vs `.text` field shapes), or `assistant.text` blocks via the **✏️ Edit In Place** button or by **double-clicking** any message body.
- **Multi-Turn Quick Jump & Unclipped Flex Scrolling**: Features a top **⚡ Jump to Turn** pill bar for instant smooth scrolling across long multi-turn tool sessions, with full Flexbox shrink protection so intermediate turns and action buttons are never clipped on narrow viewports.
- **Turn Deletion & Trailing Truncation**: Delete any single turn (e.g. a failed or rate-limited turn) or truncate from Turn $N$ onward; paired pre-turn `agent/inbox/spliced` events are stripped automatically and remaining events are re-sequenced contiguously (`seq = 0..N-1`, `turn = 1..K`, updating `messageSeqs` / `sourceEventSeqs`).
- **In-Place Title Rename & Manual Turn Append**: Update `session/title` or append a complete `User + Reasoning (optional) + Assistant` turn at the end of any session.

### 3. 🛡️ Dual Contract Pre-Flight Verification & Atomic Zstd Replacement
- **Dual `Session.prepare` Validation**: Every in-place edit is validated against both `Session.create` (live snapshot) and `Session.fromRestore` (`detached` cold restore) using isolated temporary IDs before touching disk, automatically maintaining `isSeeded: true` `inheritedEventCount` and `session/end-seed` invariants.
- **Atomic Multi-Frame Zstd Write**: Encodes via `sessionPersistence.encodeMaterialization()` (with checksummed multi-frame native `zlib.zstdCompressSync` fallback), flushes to a sibling temp file with `fsync()`, and atomically replaces `session.v4.jsonl.zstd` via `rename()`.

### 4. 🌐 Real-Time Trilingual Web UI (`EN | 中文 | 日本語`)
- Defaults to **English** with a persistent top-right **`EN | 中文 | 日本語`** switcher that updates all labels, filters, badges, turn cards, and confirmation modals instantaneously without reloading.

---

## Installation

### Option 1: Install Directly via DSH CLI

```bash
dsh plugin --profile web add github:ziyuanlingo/dsh-session-manager
```

### Option 2: Clone Locally & Mount via `link:`

1. Clone into your DSH `plugins/` directory:
   ```bash
   git clone https://github.com/ziyuanlingo/dsh-session-manager.git plugins/dsh-session-manager
   ```

2. Link in your Web Profile `package.json` (or run `dsh plugin --profile web add -w link:./plugins/dsh-session-manager`):
   ```json
   {
     "dependencies": {
       "dsh-session-manager": "link:./plugins/dsh-session-manager"
     }
   }
   ```

3. Enable in `cordis.patch.yml`:
   ```yaml
   - insert:
       - id: session-manager
         name: 'dsh-session-manager'
   ```

4. Restart the DSH Web service and refresh your browser.

---

## Usage

Once loaded, `dsh-session-manager` provides **two UI entry points**:
1. **Global Session Manager (Left Sidebar)**: Click **Session Manager** in the sidebar to search sessions by title/ID/directory, filter by workspace, **0-Turn Empty**, or **Orphaned Sessions**, batch-delete selected items, or purge all 0-turn empty sessions in one click.
2. **Per-Conversation Tab (Top Conversation Bar)**: Click **Session Editor** on any active conversation to jump to any turn, double-click or click **✏️ Edit In Place** to rewrite messages/reasoning, delete or truncate turns, and click **✨ Sync Host UI** to refresh the outer chat view immediately.

---

## HTTP API Reference

All routes are served under `/session-manager` on the same-origin DSH `webServer`:

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/session-manager` | Serves the trilingual (`EN` / `中文` / `日本語`) Session Manager Web Workbench |
| `GET` | `/session-manager/api/sessions` | Aggregates all workspace/orphan sessions, memory states, and disk byte usage |
| `GET` | `/session-manager/api/session?sessionId=<id>` | Reads full session header, structured turns, editable blocks, and attachment refs |
| `POST` | `/session-manager/api/rename` | Updates session title in place (`{ sessionId, title }`) |
| `POST` | `/session-manager/api/edit-message` | Rewrites a message or reasoning/thinking block in place (`{ sessionId, eventSeq, blockIndex, text }`) |
| `POST` | `/session-manager/api/delete-turns` | Removes specified turns in place and re-sequences events (`{ sessionId, turns: number[] }`) |
| `POST` | `/session-manager/api/append-turn` | Appends a complete turn at session end (`{ sessionId, userText, reasoningText?, assistantText }`) |
| `POST` | `/session-manager/api/delete-sessions` | Permanently deletes sessions and all associated disk files (`{ sessionIds: string[] }`) |

---

## Changelog

### `v1.0.3`
- **Trilingual Real-Time Web UI (`EN | 中文 | 日本語`)**: Added an English-by-default interface with a persistent top-right `EN | 中文 | 日本語` switcher across both the standalone Web Workbench and DSH sidebar/conversation slot embeds.
- **Locale-Neutral Backend Metadata**: Normalized fallback empty-session and orphan-workspace markers so untitled and orphaned items localize cleanly in real time.

### `v1.0.2`
- **Fixed Multi-Turn Flex Clipping**: Added `flex-shrink: 0`, `overflow: visible`, and `min-height: 0` scroll chains across `.turn-card` and iframe containers so intermediate turns, reasoning blocks, and action buttons remain accessible in long sessions.
- **Turn Quick-Jump Bar & Thinking Block Support**: Added top **⚡ Jump to Turn** pills, double-click-to-edit on message bodies, and lossless `.thinking` / `.text` block round-tripping.

---

## Development & Testing

Requires Node.js `>= 22.0.0`:

```bash
npm run check
npm test
```

---

## License

Released under the [MIT License](./LICENSE).
