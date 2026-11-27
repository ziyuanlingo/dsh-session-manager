# 🗂️ dsh-session-manager

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

**DeepSeek Harness (DSH `v0.2.x` / `v4` Zstd ログ形式) 向けインプレース・セッション編集、ターン切り詰め＆物理ストレージ完全削除プラグイン**

[![Version](https://img.shields.io/badge/Version-v1.0.3-ec6aa0.svg)](https://github.com/ziyuanlingo/dsh-session-manager/releases/tag/v1.0.3)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![DSH Compatibility](https://img.shields.io/badge/DSH-%3E%3D0.1.0--0%20%3C1.0.0-ff69b4.svg)](https://github.com/ziyuanlingo/dsh-session-manager)

---

## 概要

DeepSeek Harness（DSH `0.2.x`）を用いたマルチターン翻訳ワークベンチや長期エージェント開発では、標準のセッション機構がイベント追記（Append-only）と論理アーカイブのみに限定されており、次の2つの課題が常態化していました。
1. **セッションとディスクファイルの物理削除ができない**：標準のアーカイブ操作はサイドバー上の表示を隠すだけで、`data/dsh/sessions/` 配下のマルチフレーム Zstandard ログ（`session.v4.jsonl.zstd`）、`session_projcache` の投影スナップショット、およびアップロード済み添付ファイルがディスクを圧迫し続けます。
2. **ブランチ複製型エディタによる履歴の肥大化**：従来のサードパーティ製編集プラグインは DSH `0.2.1+` の内部 Store 変更で動作しなくなったほか、1文字修正するたびに新しいセッション ID を複製生成するため、サイドバーに不要な派生ブランチが大量に蓄積してしまいます。

**`dsh-session-manager` (`v1.0.3`)** は、外部ランタイム依存ゼロ（Node.js 22+ 標準のネイティブ Zstandard 圧縮と DSH 公式 `Session.prepare` デュアル検証を活用）で **100% 無劣化のインプレース・セッション書き換え** と **6段階の完全物理ストレージ削除** を実現します。さらに **英語・中国語・日本語（`EN | 中文 | 日本語`）のリアルタイム切替に対応した Web ワークベンチ** を備え、左サイドバーと各会話タブの双方からシームレスに利用できます。

---

## 主な機能

### 1. 🗑️ 6段階の完全物理削除（単体削除 / 一括選択削除 / 0ターン空セッション一括整理）
削除実行時、プラグインは以下の順序で安全かつ確実に全関連リソースを解放します：
1. **安全なアンロードとファイルロック解放**：対象セッションが実行中またはメモリ常駐している場合、実行中のターンをキャンセルし、`JsonlSessionHandle` の書き込みストリームをフラッシュ・クローズ（Windows/POSIX の `SessionWriteLease` ロックを解放）した上で、`agents` および `sessions` ストアからデタッチします。
2. **ワークスペースからの即時切り離し**：`workspaceRegistry` から対象セッションをデタッチし、ピン留め（Pin）・アーカイブ（Archive）状態を解除してフロントエンドのサイドバー表示をリアルタイムに更新します。
3. **セッションログディレクトリの物理削除**：`data/dsh/sessions/<workspace-slug>/<sessionId>/` ディレクトリと内部の `session.v4.jsonl.zstd` マルチフレーム圧縮ログを完全削除します（親ディレクトリが空になった場合は自動で回収）。
4. **投影キャッシュ・クエリキャッシュの消去**：`data/dsh/storages/session_projcache/sessions/<sessionId>.json` やメモリ上の投影テーブル、`coldLogMemo`、`sessionQuery` 監視キャッシュをクリアします。
5. **未参照（孤立）添付ファイルのガベージコレクション**：削除対象セッション内で参照されていた SHA-256 添付ファイル ID を走査し、他の生存セッションから一切参照されていない場合のみ `data/dsh/attachments/v1/` 配下の実体ファイルを物理削除します。
6. **プリセット紐付け情報のクリーンアップ**：`dsh-preset-enhance` が導入されている環境では、`state.json` 内の残存 `bindings[sessionId]` および `sessions[sessionId]` も自動的に整理します。

### 2. ✏️ 無劣化インプレース編集（複製セッションの一切ない直接書き換え）
すべての編集は**元のセッション ID のままインプレースで適用**され、ワークスペース配置・ツール呼び出し履歴・プリセット設定を完全に維持します：
- **任意メッセージ・思考ブロックの直接編集**：ユーザー発言（`user/message`）、思考チェーン（`assistant.reasoning` / `assistant.thinking`、元の `.thinking` / `.text` フィールド構造を無劣化保持）、アシスタント応答本文（`assistant.text`）を **「✏️ 編集」** ボタンまたは**本文のダブルクリック**で即座に編集可能。
- **マルチターン高速ジャンプ＆欠損のないスクロール設計**：上部の **⚡ ターン移動ピルバー** から中間ターンへ滑らかにスクロール移動でき、Flexbox の圧縮防止設計により長大なツール併用セッションや狭幅画面でも思考ブロックや操作ボタンが隠れません。
- **指定ターンの削除・後続ターンの切り詰め（巻き戻し）**：エラーになった単一ターンの除去や、第 $N$ ターン以降の一括切り詰めに対応。対になるターン開始前の `agent/inbox/spliced` イベントも自動で除去し、残存イベントを連番（`seq = 0..N-1`, `turn = 1..K`）へ振り直して `messageSeqs` / `sourceEventSeqs` の参照整合性を維持します。
- **タイトル変更＆末尾への手動ターン追加**：`session/title` の直接更新や、セッション末尾への完全な1ターン（`User + Reasoning (任意) + Assistant`）の手動追記に対応しています。

### 3. 🛡️ デュアル事前契約検証＆アトミックなマルチフレーム Zstd 書き換え
- **ディスク書き込み前のデュアル `Session.prepare` 検証**：すべての書き換え処理はディスクへ触れる前に、独立した一時検証 ID を用いて `Session.create`（ライブスナップショット）と `Session.fromRestore`（`detached` コールドリストア）の双方で事前検証を実施します。`isSeeded: true` のフォーク継承セッションにおける `inheritedEventCount` と `session/end-seed` 境界も自動的に保全されます。
- **アトミックな Zstd ファイル置換**：ホストの `sessionPersistence.encodeMaterialization()`（チェックサム付きネイティブ `zlib.zstdCompressSync` フォールバック内蔵）でエンコード後、同一ディレクトリの一時ファイルへ `fsync()` まで完了してからアトミックな `rename()` で置換します。

### 4. 🌐 英語・中国語・日本語リアルタイム切替 Web UI (`EN | 中文 | 日本語`)
- デフォルトはクリーンな英語インターフェースで、右上に常設された **`EN | 中文 | 日本語`** スイッチャーからページ再読み込みなしで全ラベル・フィルタ・確認ダイアログを即座に切り替えられます。

---

## インストール方法

### 方法 1：DSH CLI から直接インストール

```bash
dsh plugin --profile web add github:ziyuanlingo/dsh-session-manager
```

### 方法 2：ローカルへクローンして `link:` でマウント

1. DSH の `plugins/` ディレクトリへクローンします：
   ```bash
   git clone https://github.com/ziyuanlingo/dsh-session-manager.git plugins/dsh-session-manager
   ```

2. Web プロファイルの `package.json` にリンク依存を追加します（または `dsh plugin --profile web add -w link:./plugins/dsh-session-manager` を実行）：
   ```json
   {
     "dependencies": {
       "dsh-session-manager": "link:./plugins/dsh-session-manager"
     }
   }
   ```

3. `cordis.patch.yml` でプラグインを有効化します：
   ```yaml
   - insert:
       - id: session-manager
         name: 'dsh-session-manager'
   ```

4. DSH Web サービスを再起動し、ブラウザを再読み込みします。

---

## 使い方

プラグイン有効化後、DSH Web 画面に**2つの導線**が追加されます：
1. **グローバル管理パネル（左サイドバー）**：サイドバーの **「Session Manager / セッション管理」** アイコンをクリックし、キーワード検索やワークスペース別・**0ターン空セッション**・**孤立セッション**での絞り込み、選択項目の一括完全削除、空セッションのワンクリック整理を実行できます。
2. **会話タブ内クイック編集（会話画面上部タブ）**：任意の会話上部の **「Session Editor / セッション編集・削除」** タブを開き、上部ピルバーからのターン移動、ダブルクリックでの本文・思考チェーン編集、不要ターンの削除・切り詰めを行い、**「✨ メイン画面へ同期」** ボタンで即座にチャット表示へ反映できます。

---

## HTTP API リファレンス

すべてのエンドポイントはホスト DSH `webServer` の `/session-manager` 配下で提供されます：

| メソッド | パス | 説明 |
| :--- | :--- | :--- |
| `GET` | `/session-manager` | 3言語（`EN` / `中文` / `日本語`）リアルタイム切替対応の管理ワークベンチを配信 |
| `GET` | `/session-manager/api/sessions` | 全ワークスペース・孤立セッション、メモリ状態、ディスク使用量を集約取得 |
| `GET` | `/session-manager/api/session?sessionId=<id>` | 単一セッションのヘッダ、構造化ターン、編集可能ブロック、添付ファイル参照を取得 |
| `POST` | `/session-manager/api/rename` | セッションタイトルをインプレース更新（`{ sessionId, title }`） |
| `POST` | `/session-manager/api/edit-message` | 指定メッセージまたは思考ブロックをインプレース書き換え（`{ sessionId, eventSeq, blockIndex, text }`） |
| `POST` | `/session-manager/api/delete-turns` | 指定ターン群をインプレース削除しイベント連番を再構築（`{ sessionId, turns: number[] }`） |
| `POST` | `/session-manager/api/append-turn` | セッション末尾へ1ターンを手動追記（`{ sessionId, userText, reasoningText?, assistantText }`） |
| `POST` | `/session-manager/api/delete-sessions` | 1つ以上のセッションと全関連ディスクファイルを完全物理削除（`{ sessionIds: string[] }`） |

---

## 更新履歴

### `v1.0.3`
- **3言語リアルタイム切替 Web UI (`EN | 中文 | 日本語`) の搭載**：デフォルト英語表示と右上の常設言語スイッチャーを追加し、Web ワークベンチおよび DSH サイドバー／会話タブ埋め込みの双方で言語設定を共有。
- **バックエンドのロケール中立化**：無題セッションおよび孤立ワークスペースのフォールバック表現を構造化し、言語切替時にハードコード文字列が残らないよう改善。

### `v1.0.2`
- **マルチターン表示における Flexbox 圧縮欠損の修正**：`.turn-card` および各コンテナに `flex-shrink: 0`・`overflow: visible`・`min-height: 0` を適用し、中間ターンの思考ブロックや長いモデル名による編集ボタンの押し出しを解消。
- **ターン移動ピルバー＆ `thinking` ブロック無劣化保存**：上部の **⚡ ターン移動バー**、本文ダブルクリック編集、および `.thinking` / `.text` 思考ブロックの無劣化書き戻しに対応。

---

## 開発とテスト

Node.js `>= 22.0.0` が必要です：

```bash
npm run check
npm test
```

---

## ライセンス

[MIT License](./LICENSE) のもとで公開されています。
