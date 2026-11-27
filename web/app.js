const API_BASE = '/session-manager/api';
const LANG_STORAGE_KEY = 'dsh_i18n_lang';

const I18N = {
  en: {
    docTitle: '🗂️ DSH Session Manager & In-Place Editor v1.0.3',
    brandTitle: '🗂️ DSH Session Manager',
    tipRefresh: 'Refresh session list',
    btnRefresh: '🔄 Refresh',
    loadingSessions: 'Loading sessions…',
    loadFailed: 'Failed to load: {err}',
    phSearch: '🔍 Search title / ID / directory…',
    lblSelectAll: 'Select All',
    tipCleanEmpty: 'Physically purge all 0-turn empty sessions',
    btnCleanEmpty: '🧹 Purge Empty',
    btnBatchDelete: '🗑️ Delete Selected ({count})',
    optAllSessions: '📂 All Sessions ({count})',
    optEmptySessions: '🧹 0-Turn Empty ({count})',
    optOrphanSessions: '👻 Orphaned Sessions ({count})',
    globalStatsSummary: '{total} sessions · Disk {size} · Empty {empty}',
    noFilteredSessions: 'No sessions match the current filter.',
    untitledSession: '(Untitled Empty Session)',
    orphanWorkspace: 'Orphaned Session',
    badgeTurns: '{count} turns',
    badgeRunning: 'Running',
    badgeInMemory: 'In Memory',
    badgeOrphan: 'Orphan',
    tipDeleteItem: 'Permanently delete this session and its disk files',
    tipToggleSidebar: 'Show / hide session list',
    btnToggleSidebar: '☰ Sessions',
    paneSubtitle: 'v1.0.3 · In-Place Zstd Lossless Rewrite & True Physical Storage Cleaner',
    emptyStateTitle: 'Select any session on the left to inspect, edit in place, or physically delete',
    emptyStateDesc: 'Supports lossless in-place editing of user messages, reasoning/thinking blocks, and assistant replies (zero duplicate session clones), turn trimming, and complete physical removal of <code>.jsonl.zstd</code> logs, projection caches, and orphaned attachments.',
    phSessionTitle: 'Enter session title…',
    btnSaveTitle: '💾 Save Title',
    tipReloadHost: 'Reload outer DSH view to reflect updated conversation',
    btnReloadHost: '✨ Sync Host UI',
    btnDeleteCurrent: '🗑️ Delete Session & Files',
    metaSessionId: 'Session ID:',
    metaPreset: 'Preset:',
    metaEvents: 'Total Events:',
    metaEventsVal: '{count}',
    metaDiskSize: 'Disk Usage:',
    metaLogPath: 'Log File:',
    metaAttachments: 'Attachments:',
    metaAttachmentsVal: '{count}',
    emptyTurnsHint: 'This session has 0 conversation turns. You can append a turn below or delete this empty session.',
    turnNavLabel: '⚡ Jump to Turn ({count}):',
    turnNavPillTools: 'Turn {turn} · 🔧{tools}',
    turnNavPill: 'Turn {turn}',
    turnCardTitle: 'Turn {turn}',
    badgeToolCalls: '🔧 Tool Calls ×{count}',
    btnDeleteTurn: '✂️ Delete Turn',
    confirmDeleteTurnTitle: 'Delete Turn {turn}',
    confirmDeleteTurnMsg: 'Remove Turn {turn} in place from this session?\nSubsequent turns will be cleanly re-numbered without creating duplicate session copies.',
    confirmDeleteTurnBtn: 'Delete Turn',
    toastTurnDeleted: '✅ Removed Turn {turn} in place! Click "✨ Sync Host UI" to view changes in chat.',
    errDeleteTurn: 'Failed to delete turn: {err}',
    btnTruncateFrom: '⏭️ Truncate from Turn {turn} ({count} turns)',
    confirmTruncateTitle: 'Truncate Conversation History',
    confirmTruncateMsg: 'Remove Turn {turn} through the end ({count} turns total) and rewind the session before Turn {turn}?',
    confirmTruncateBtn: 'Truncate',
    toastTruncated: '✅ Truncated {count} trailing turn(s) in place!',
    errTruncate: 'Failed to truncate: {err}',
    stepToolsPrefix: '🔧 Tools invoked in step: ',
    roleUserTag: '👤 User Input (seq={seq})',
    roleReasoningTag: '💭 Reasoning ({model} · seq={seq})',
    inlineThinkingSuffix: ' · inline thinking',
    roleAssistantTag: '🤖 Assistant Reply ({model} · seq={seq}{inline})',
    btnEditInPlace: '✏️ Edit In Place',
    emptyToolStepText: '(Empty text on tool step — double-click or click Edit to add text)',
    emptyContentText: '(Empty content)',
    tipDoubleClickEdit: 'Double-click text or click "✏️ Edit In Place" to modify',
    btnCancel: 'Cancel',
    btnSaveEdit: '💾 Save In Place',
    btnSaving: 'Saving…',
    toastMsgSaved: '✅ Message saved in place to Zstd log! Click "✨ Sync Host UI" to refresh chat view.',
    errSaveEdit: 'Failed to save edit: {err}',
    confirmDelSessionsTitle: '🗑️ Permanently Delete Sessions & Disk Files',
    confirmDelSessionsMsg: 'Permanently delete {target}?\n\nThis operation physically removes:\n1. Workspace sidebar entries & live in-memory instances\n2. Session directories & session.v4.jsonl.zstd logs\n3. Projection cache (.json) & preset bindings\n4. Unreferenced uploaded attachments\n\nThis cannot be undone!',
    confirmDelSessionsBtn: 'Delete Permanently ({count})',
    toastDeletedSessions: '✅ Permanently deleted {count} session(s), freeing {size} on disk!',
    errDeleteSessions: 'Deletion failed: {err}',
    targetBatchCount: '{count} selected session(s)',
    targetEmptyCount: 'all {count} empty 0-turn session(s)',
    targetSingleSession: 'session "{title}"',
    toastNoEmptySessions: 'No 0-turn empty sessions to clean.',
    toastNeedNonEmptyTitle: 'Please enter a non-empty session title.',
    toastTitleSaved: '✅ Session title updated in place!',
    errRename: 'Rename failed: {err}',
    errReadSession: 'Failed to read session detail: {err}',
    appendSummary: '➕ Append a Complete Turn at Session End (In-Place Write)',
    lblAppendUser: '👤 User Message:',
    phAppendUser: 'Enter user message…',
    lblAppendReasoning: '💭 Assistant Reasoning (Optional):',
    phAppendReasoning: 'Optional internal reasoning…',
    lblAppendAssistant: '🤖 Assistant Reply:',
    phAppendAssistant: 'Enter assistant reply content…',
    btnAppendTurn: '➕ Append & Save In Place',
    toastNeedAppendFields: 'Please fill in both User Message and Assistant Reply.',
    toastTurnAppended: '✅ Appended new turn at session end in place!',
    errAppendTurn: 'Append failed: {err}',
  },
  'zh-CN': {
    docTitle: '🗂️ DSH 会话管理与原地编辑工作台 v1.0.3',
    brandTitle: '🗂️ DSH 会话管理工作台',
    tipRefresh: '刷新会话列表',
    btnRefresh: '🔄 刷新',
    loadingSessions: '正在加载会话数据…',
    loadFailed: '加载失败：{err}',
    phSearch: '🔍 搜索会话标题 / ID / 目录…',
    lblSelectAll: '全选当前',
    tipCleanEmpty: '一键物理清理所有 0 轮空会话',
    btnCleanEmpty: '🧹 清空会话',
    btnBatchDelete: '🗑️ 彻底删除选中 ({count})',
    optAllSessions: '📂 全部会话 ({count})',
    optEmptySessions: '🧹 0轮空会话 ({count})',
    optOrphanSessions: '👻 未归属孤儿会话 ({count})',
    globalStatsSummary: '共 {total} 个会话 · 磁盘占用 {size} · 空会话 {empty} 个',
    noFilteredSessions: '当前筛选条件下没有会话。',
    untitledSession: '（未命名空会话）',
    orphanWorkspace: '未归属孤儿会话',
    badgeTurns: '{count} 轮',
    badgeRunning: '运行中',
    badgeInMemory: '内存中',
    badgeOrphan: '孤儿文件',
    tipDeleteItem: '彻底物理删除此会话及磁盘文件',
    tipToggleSidebar: '展开/收起左侧列表',
    btnToggleSidebar: '☰ 会话列表',
    paneSubtitle: 'v1.0.3 · 多帧 Zstd 原地无损重写 & 六步彻底物理级存储清理',
    emptyStateTitle: '选择左侧任意会话即可查看、原地修改内容或彻底物理删除',
    emptyStateDesc: '支持原地无损修改用户消息、思考链与助手回复（不产生多余副本），删除任意回合，以及连同磁盘 <code>.jsonl.zstd</code>、投影缓存与孤儿附件一并彻底物理删除。',
    phSessionTitle: '输入会话标题…',
    btnSaveTitle: '💾 保存标题',
    tipReloadHost: '通知外层 DSH 刷新页面以同步展示最新修改后的对话',
    btnReloadHost: '✨ 同步刷新主界面',
    btnDeleteCurrent: '🗑️ 彻底删除此会话及文件',
    metaSessionId: '会话 ID:',
    metaPreset: '模式:',
    metaEvents: '总事件数:',
    metaEventsVal: '{count} 条',
    metaDiskSize: '物理占用:',
    metaLogPath: '磁盘日志:',
    metaAttachments: '关联附件:',
    metaAttachmentsVal: '{count} 个',
    emptyTurnsHint: '当前会话还没有任何对话回合（0 轮空会话），可以在下方手动追加对话，或直接彻底删除此空会话。',
    turnNavLabel: '⚡ 轮次直达 ({count}轮)：',
    turnNavPillTools: '第 {turn} 轮 · 🔧{tools}',
    turnNavPill: '第 {turn} 轮',
    turnCardTitle: '第 {turn} 轮对话',
    badgeToolCalls: '🔧 工具调用 ×{count}',
    btnDeleteTurn: '✂️ 删除本轮',
    confirmDeleteTurnTitle: '删除第 {turn} 轮对话',
    confirmDeleteTurnMsg: '确定要从当前会话中原地移除第 {turn} 轮对话吗？\n后续回合将自动重排连续序号并保留，不会产生新会话副本。',
    confirmDeleteTurnBtn: '确认删除本轮',
    toastTurnDeleted: '✅ 已原地移除第 {turn} 轮对话并更新磁盘文件！可点上方「✨ 同步刷新主界面」查看最新对话。',
    errDeleteTurn: '删除本轮失败：{err}',
    btnTruncateFrom: '⏭️ 从第 {turn} 轮起向后截断 ({count}轮)',
    confirmTruncateTitle: '向后截断对话历史',
    confirmTruncateMsg: '确定要删除第 {turn} 轮至最后一轮（共 {count} 轮）的所有内容，将对话回退到第 {turn} 轮之前吗？',
    confirmTruncateBtn: '确认截断',
    toastTruncated: '✅ 已成功截断移除后 {count} 轮对话！',
    errTruncate: '截断失败：{err}',
    stepToolsPrefix: '🔧 本步调用工具：',
    roleUserTag: '👤 用户输入 (seq={seq})',
    roleReasoningTag: '💭 思考链 Reasoning ({model} · seq={seq})',
    inlineThinkingSuffix: ' · 含内嵌思考',
    roleAssistantTag: '🤖 助手正文回复 ({model} · seq={seq}{inline})',
    btnEditInPlace: '✏️ 原地编辑',
    emptyToolStepText: '（工具步骤空文本，可按需双击或点击编辑）',
    emptyContentText: '（空内容）',
    tipDoubleClickEdit: '双击文本或点击右上角「✏️ 原地编辑」即可修改',
    btnCancel: '取消',
    btnSaveEdit: '💾 原地保存修改',
    btnSaving: '保存中…',
    toastMsgSaved: '✅ 消息内容已原地无损写回会话文件！点击上方「✨ 同步刷新主界面」即可在聊天窗看到更新。',
    errSaveEdit: '保存修改失败：{err}',
    confirmDelSessionsTitle: '🗑️ 彻底物理删除会话及关联文件',
    confirmDelSessionsMsg: '确定要彻底删除 {target} 吗？\n\n此操作将同时清理：\n1. 工作区侧边栏记录与内存活跃实例\n2. 磁盘会话文件夹与 session.v4.jsonl.zstd 日志\n3. 投影缓存文件 (.json) 与预设绑定记录\n4. 不再被其他会话引用的专属上传附件\n\n物理删除后不可恢复！',
    confirmDelSessionsBtn: '确认彻底删除 ({count})',
    toastDeletedSessions: '✅ 已彻底物理删除 {count} 个会话，释放磁盘空间 {size}！',
    errDeleteSessions: '删除失败：{err}',
    targetBatchCount: '选中的 {count} 个会话',
    targetEmptyCount: '全部 {count} 个 0 轮空会话',
    targetSingleSession: '会话「{title}」',
    toastNoEmptySessions: '当前没有任何 0 轮空会话需要清理。',
    toastNeedNonEmptyTitle: '请输入非空的会话标题。',
    toastTitleSaved: '✅ 会话标题已原地更新保存！',
    errRename: '重命名失败：{err}',
    errReadSession: '读取会话详情失败：{err}',
    appendSummary: '➕ 在本会话末尾手动追加一轮对话（原地写入）',
    lblAppendUser: '👤 用户消息内容（User）：',
    phAppendUser: '输入用户侧话语…',
    lblAppendReasoning: '💭 助手思考块（Reasoning，选填）：',
    phAppendReasoning: '选填：内部思考内容…',
    lblAppendAssistant: '🤖 助手正式回复（Assistant）：',
    phAppendAssistant: '输入助手回复正文…',
    btnAppendTurn: '➕ 立即追加并原地保存',
    toastNeedAppendFields: '请填写完整的用户消息内容与助手回复正文。',
    toastTurnAppended: '✅ 新的一轮对话已原地写入会话末尾！',
    errAppendTurn: '追加失败：{err}',
  },
  ja: {
    docTitle: '🗂️ DSH セッション管理＆インプレース編集ワークベンチ v1.0.3',
    brandTitle: '🗂️ DSH セッション管理',
    tipRefresh: 'セッション一覧を更新',
    btnRefresh: '🔄 更新',
    loadingSessions: 'セッション情報を読み込み中…',
    loadFailed: '読み込み失敗：{err}',
    phSearch: '🔍 タイトル / ID / ディレクトリで検索…',
    lblSelectAll: 'すべて選択',
    tipCleanEmpty: '0ターンの空セッションを一括物理削除',
    btnCleanEmpty: '🧹 空セッション整理',
    btnBatchDelete: '🗑️ 選択項目を完全削除 ({count})',
    optAllSessions: '📂 すべてのセッション ({count})',
    optEmptySessions: '🧹 0ターン空セッション ({count})',
    optOrphanSessions: '👻 未所属の孤立セッション ({count})',
    globalStatsSummary: '全 {total} 件 · ディスク使用量 {size} · 空セッション {empty} 件',
    noFilteredSessions: '現在のフィルタ条件に一致するセッションはありません。',
    untitledSession: '（無題の空セッション）',
    orphanWorkspace: '孤立セッション',
    badgeTurns: '{count} ターン',
    badgeRunning: '実行中',
    badgeInMemory: 'メモリ常駐',
    badgeOrphan: '孤立ファイル',
    tipDeleteItem: 'このセッションとディスク上の全関連ファイルを完全削除',
    tipToggleSidebar: 'セッション一覧の表示 / 非表示',
    btnToggleSidebar: '☰ 一覧',
    paneSubtitle: 'v1.0.3 · マルチフレームZstd無劣化インプレース書換＆物理ストレージ完全削除',
    emptyStateTitle: '左側のリストからセッションを選択して内容確認・インプレース編集・完全削除を実行',
    emptyStateDesc: 'ユーザー発言・思考チェーン（Reasoning / Thinking）・アシスタント応答の無劣化インプレース編集（不要な複製セッションを作らない）、指定ターンの削除や切り詰め、および <code>.jsonl.zstd</code> ログ・投影キャッシュ・未参照添付ファイルの完全物理削除に対応しています。',
    phSessionTitle: 'セッションタイトルを入力…',
    btnSaveTitle: '💾 タイトル保存',
    tipReloadHost: '外側のDSH画面を再読み込みして最新の会話内容を反映',
    btnReloadHost: '✨ メイン画面へ同期',
    btnDeleteCurrent: '🗑️ このセッションを完全削除',
    metaSessionId: 'セッションID:',
    metaPreset: 'プリセット:',
    metaEvents: '総イベント数:',
    metaEventsVal: '{count} 件',
    metaDiskSize: '物理サイズ:',
    metaLogPath: 'ログファイル:',
    metaAttachments: '添付ファイル:',
    metaAttachmentsVal: '{count} 個',
    emptyTurnsHint: 'このセッションにはまだ会話ターンがありません（0ターン空セッション）。下部からターンを追加するか、このまま完全削除できます。',
    turnNavLabel: '⚡ ターン移動 ({count})：',
    turnNavPillTools: '第 {turn} ターン · 🔧{tools}',
    turnNavPill: '第 {turn} ターン',
    turnCardTitle: '第 {turn} ターン',
    badgeToolCalls: '🔧 ツール呼び出し ×{count}',
    btnDeleteTurn: '✂️ このターンを削除',
    confirmDeleteTurnTitle: '第 {turn} ターンの削除',
    confirmDeleteTurnMsg: '現在のセッションから第 {turn} ターンをインプレース削除しますか？\n後続のターン番号は自動的に連番へ振り直され、別セッションの複製は生成されません。',
    confirmDeleteTurnBtn: '削除する',
    toastTurnDeleted: '✅ 第 {turn} ターンをインプレース削除しました！「✨ メイン画面へ同期」でチャット表示を更新できます。',
    errDeleteTurn: 'ターン削除エラー：{err}',
    btnTruncateFrom: '⏭️ 第 {turn} ターン以降を切り詰め ({count}件)',
    confirmTruncateTitle: '会話履歴の切り詰め（巻き戻し）',
    confirmTruncateMsg: '第 {turn} ターンから最終ターンまで（計 {count} ターン）をすべて削除し、第 {turn} ターン直前の状態へ巻き戻しますか？',
    confirmTruncateBtn: '切り詰める',
    toastTruncated: '✅ 後続の {count} ターンを切り詰め削除しました！',
    errTruncate: '切り詰めエラー：{err}',
    stepToolsPrefix: '🔧 実行ツール：',
    roleUserTag: '👤 ユーザー入力 (seq={seq})',
    roleReasoningTag: '💭 思考チェーン Reasoning ({model} · seq={seq})',
    inlineThinkingSuffix: ' · 埋め込み思考あり',
    roleAssistantTag: '🤖 アシスタント応答 ({model} · seq={seq}{inline})',
    btnEditInPlace: '✏️ 編集',
    emptyToolStepText: '（ツール実行ステップの空テキスト — ダブルクリックまたは編集ボタンで追記可能）',
    emptyContentText: '（空のコンテンツ）',
    tipDoubleClickEdit: 'ダブルクリックまたは「✏️ 編集」ボタンでインプレース編集',
    btnCancel: 'キャンセル',
    btnSaveEdit: '💾 インプレース保存',
    btnSaving: '保存中…',
    toastMsgSaved: '✅ メッセージをZstdログへ無劣化保存しました！「✨ メイン画面へ同期」で反映できます。',
    errSaveEdit: '保存エラー：{err}',
    confirmDelSessionsTitle: '🗑️ セッションと関連ファイルの完全物理削除',
    confirmDelSessionsMsg: '{target} を完全に物理削除しますか？\n\n以下のデータがすべて削除されます：\n1. ワークスペース一覧の登録とメモリ上のインスタンス\n2. セッションフォルダおよび session.v4.jsonl.zstd ログ\n3. 投影キャッシュ (.json) とプリセット紐付け情報\n4. 他セッションから参照されていない添付ファイル\n\n削除後は元に戻せません！',
    confirmDelSessionsBtn: '完全削除を実行 ({count})',
    toastDeletedSessions: '✅ {count} 件のセッションを完全削除し、ディスク領域 {size} を解放しました！',
    errDeleteSessions: '削除エラー：{err}',
    targetBatchCount: '選択した {count} 件のセッション',
    targetEmptyCount: '全 {count} 件の0ターン空セッション',
    targetSingleSession: 'セッション「{title}」',
    toastNoEmptySessions: '整理対象の0ターン空セッションはありません。',
    toastNeedNonEmptyTitle: '空でないセッションタイトルを入力してください。',
    toastTitleSaved: '✅ セッションタイトルをインプレース更新しました！',
    errRename: '名前変更エラー：{err}',
    errReadSession: '詳細読み込みエラー：{err}',
    appendSummary: '➕ セッション末尾へ1ターン手動追加（インプレース書込）',
    lblAppendUser: '👤 ユーザーメッセージ (User)：',
    phAppendUser: 'ユーザー側の発話を入力…',
    lblAppendReasoning: '💭 アシスタント思考ブロック (Reasoning・任意)：',
    phAppendReasoning: '任意：内部推論テキスト…',
    lblAppendAssistant: '🤖 アシスタント応答本文 (Assistant)：',
    phAppendAssistant: 'アシスタントの応答本文を入力…',
    btnAppendTurn: '➕ 追加してインプレース保存',
    toastNeedAppendFields: 'ユーザーメッセージとアシスタント応答の両方を入力してください。',
    toastTurnAppended: '✅ セッション末尾に新しいターンをインプレース追加しました！',
    errAppendTurn: 'ターン追加エラー：{err}',
  },
};

function detectInitialLang() {
  try {
    const saved = window.localStorage?.getItem(LANG_STORAGE_KEY);
    if (saved && Object.prototype.hasOwnProperty.call(I18N, saved)) {
      return saved;
    }
  } catch { /* ignore */ }
  return 'en';
}

let currentLang = detectInitialLang();

function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N.en;
  const template = dict[key] ?? I18N.en[key] ?? key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) =>
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''
  );
}

const params = new URLSearchParams(window.location.search);
const initialSessionId = params.get('sessionId') || '';
const viewKind = params.get('view') || 'main';

const state = {
  summary: null,
  filteredSessions: [],
  selectedIds: new Set(),
  activeSessionId: initialSessionId,
  activeDetail: null,
  searchQuery: '',
  workspaceFilter: '__all__',
};

const els = {
  sidebar: document.getElementById('sidebar'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnRefreshList: document.getElementById('btn-refresh-list'),
  globalStats: document.getElementById('global-stats'),
  searchInput: document.getElementById('search-input'),
  workspaceFilter: document.getElementById('workspace-filter'),
  checkAll: document.getElementById('check-all'),
  btnCleanEmpty: document.getElementById('btn-clean-empty'),
  btnBatchDelete: document.getElementById('btn-batch-delete'),
  sessionList: document.getElementById('session-list'),
  emptyState: document.getElementById('empty-state'),
  sessionDetail: document.getElementById('session-detail'),
  detailTitleInput: document.getElementById('detail-title-input'),
  btnSaveTitle: document.getElementById('btn-save-title'),
  btnReloadHost: document.getElementById('btn-reload-host'),
  btnDeleteCurrent: document.getElementById('btn-delete-current'),
  detailMeta: document.getElementById('detail-meta'),
  turnNavBar: document.getElementById('turn-nav-bar'),
  toastBanner: document.getElementById('toast-banner'),
  turnsContainer: document.getElementById('turns-container'),
  appendDetails: document.getElementById('append-details'),
  appendUser: document.getElementById('append-user'),
  appendReasoning: document.getElementById('append-reasoning'),
  appendAssistant: document.getElementById('append-assistant'),
  btnAppendTurn: document.getElementById('btn-append-turn'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalTitle: document.getElementById('modal-title'),
  modalMessage: document.getElementById('modal-message'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm'),
};

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t('docTitle');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
}

function setLanguage(lang) {
  if (!Object.prototype.hasOwnProperty.call(I18N, lang)) return;
  currentLang = lang;
  try {
    window.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch { /* ignore */ }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'dsh-i18n-lang', lang }, window.location.origin);
    }
  } catch { /* ignore */ }

  applyStaticTranslations();
  renderWorkspaceOptions();
  renderSessionList();
  if (state.activeDetail && !els.sessionDetail.classList.contains('hidden')) {
    renderSessionDetail(state.activeDetail);
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTime(ts) {
  if (!ts) return '-';
  try {
    const locale = currentLang === 'ja' ? 'ja-JP' : (currentLang === 'zh-CN' ? 'zh-CN' : 'en-US');
    return new Date(ts).toLocaleString(locale, { hour12: false });
  } catch {
    return '-';
  }
}

function displaySessionTitle(s) {
  const raw = (s?.title || '').trim();
  if (!raw || raw === '（未命名空会话）' || raw === '（日志待修复或空会话）') {
    return t('untitledSession');
  }
  return raw;
}

function displayWorkspaceTitle(s) {
  if (s?.isOrphan || !s?.workspaceTitle || s.workspaceTitle === '未归属孤儿会话') {
    return t('orphanWorkspace');
  }
  return s.workspaceTitle;
}

let toastTimer = null;
function showToast(msg, isError = false) {
  els.toastBanner.textContent = msg;
  els.toastBanner.classList.remove('hidden', 'error');
  if (isError) els.toastBanner.classList.add('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toastBanner.classList.add('hidden');
  }, 4800);
}

function askConfirm(title, message, confirmLabel) {
  return new Promise((resolve) => {
    els.modalTitle.textContent = title;
    els.modalMessage.textContent = message;
    els.modalConfirm.textContent = confirmLabel;
    els.modalCancel.textContent = t('btnCancel');
    els.modalBackdrop.classList.remove('hidden');

    const cleanup = (val) => {
      els.modalBackdrop.classList.add('hidden');
      els.modalCancel.onclick = null;
      els.modalConfirm.onclick = null;
      resolve(val);
    };
    els.modalCancel.onclick = () => cleanup(false);
    els.modalConfirm.onclick = () => cleanup(true);
  });
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function applyFilters() {
  const all = state.summary?.sessions ?? [];
  const q = state.searchQuery.trim().toLowerCase();
  const wf = state.workspaceFilter;

  state.filteredSessions = all.filter((s) => {
    if (wf === '__empty__' && s.turnCount !== 0) return false;
    if (wf === '__orphan__' && !s.isOrphan) return false;
    if (wf !== '__all__' && wf !== '__empty__' && wf !== '__orphan__' && s.workspaceId !== wf) {
      return false;
    }
    if (!q) return true;
    return (
      displaySessionTitle(s).toLowerCase().includes(q) ||
      s.sessionId.toLowerCase().includes(q) ||
      (s.cwd || '').toLowerCase().includes(q) ||
      displayWorkspaceTitle(s).toLowerCase().includes(q)
    );
  });
}

function updateBatchControls() {
  const count = state.selectedIds.size;
  els.btnBatchDelete.textContent = t('btnBatchDelete', { count });
  els.btnBatchDelete.disabled = count === 0;

  const visibleIds = state.filteredSessions.map(s => s.sessionId);
  els.checkAll.checked = visibleIds.length > 0 && visibleIds.every(id => state.selectedIds.has(id));
}

function renderWorkspaceOptions() {
  const prev = els.workspaceFilter.value || '__all__';
  const workspaces = state.summary?.workspaces ?? [];
  els.workspaceFilter.innerHTML = '';

  const addOpt = (val, text) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    els.workspaceFilter.appendChild(opt);
  };

  addOpt('__all__', t('optAllSessions', { count: state.summary?.totalSessions ?? 0 }));
  addOpt('__empty__', t('optEmptySessions', { count: state.summary?.emptyCount ?? 0 }));
  if ((state.summary?.orphanCount ?? 0) > 0) {
    addOpt('__orphan__', t('optOrphanSessions', { count: state.summary.orphanCount }));
  }
  for (const ws of workspaces) {
    addOpt(ws.id, `📁 ${ws.title} (${ws.sessionCount})`);
  }

  if ([...els.workspaceFilter.options].some(o => o.value === prev)) {
    els.workspaceFilter.value = prev;
  } else {
    els.workspaceFilter.value = '__all__';
  }
  state.workspaceFilter = els.workspaceFilter.value;
}

function renderSessionList() {
  applyFilters();
  els.sessionList.innerHTML = '';

  if (state.summary) {
    els.globalStats.textContent = t('globalStatsSummary', {
      total: state.summary.totalSessions,
      size: formatBytes(state.summary.totalBytes),
      empty: state.summary.emptyCount,
    });
  }

  if (state.filteredSessions.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    empty.style.color = 'var(--text-muted)';
    empty.textContent = t('noFilteredSessions');
    els.sessionList.appendChild(empty);
    updateBatchControls();
    return;
  }

  for (const s of state.filteredSessions) {
    const row = document.createElement('div');
    row.className = 'session-item' + (s.sessionId === state.activeSessionId ? ' active' : '');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'session-item-check';
    check.checked = state.selectedIds.has(s.sessionId);
    check.onclick = (e) => {
      e.stopPropagation();
      if (check.checked) state.selectedIds.add(s.sessionId);
      else state.selectedIds.delete(s.sessionId);
      updateBatchControls();
    };

    const body = document.createElement('div');
    body.className = 'session-item-body';

    const resolvedTitle = displaySessionTitle(s);
    const titleEl = document.createElement('div');
    titleEl.className = 'session-item-title';
    titleEl.textContent = (s.isPinned ? '📌 ' : '') + resolvedTitle;

    const sub = document.createElement('div');
    sub.className = 'session-item-sub';

    const turnBadge = document.createElement('span');
    turnBadge.className = 'badge' + (s.turnCount === 0 ? ' badge-empty' : '');
    turnBadge.textContent = t('badgeTurns', { count: s.turnCount });
    sub.appendChild(turnBadge);

    const sizeBadge = document.createElement('span');
    sizeBadge.className = 'badge';
    sizeBadge.textContent = formatBytes(s.totalBytes);
    sub.appendChild(sizeBadge);

    if (s.isLive) {
      const liveB = document.createElement('span');
      liveB.className = 'badge badge-live';
      liveB.textContent = s.isRunning ? t('badgeRunning') : t('badgeInMemory');
      sub.appendChild(liveB);
    }
    if (s.isOrphan) {
      const orpB = document.createElement('span');
      orpB.className = 'badge badge-orphan';
      orpB.textContent = t('badgeOrphan');
      sub.appendChild(orpB);
    }

    const wsSpan = document.createElement('span');
    wsSpan.textContent = displayWorkspaceTitle(s);
    sub.appendChild(wsSpan);

    body.append(titleEl, sub);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost session-item-del';
    delBtn.title = t('tipDeleteItem');
    delBtn.textContent = '🗑️';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      await handleDeleteSessions([s.sessionId], t('targetSingleSession', { title: resolvedTitle }));
    };

    row.onclick = () => selectSession(s.sessionId);
    row.append(check, body, delBtn);
    els.sessionList.appendChild(row);
  }

  updateBatchControls();
}

async function loadSessionsSummary() {
  try {
    state.summary = await apiGet('/sessions');
    const validIds = new Set(state.summary.sessions.map(s => s.sessionId));
    for (const id of [...state.selectedIds]) {
      if (!validIds.has(id)) state.selectedIds.delete(id);
    }
    renderWorkspaceOptions();
    renderSessionList();
  } catch (err) {
    els.globalStats.textContent = t('loadFailed', { err: err.message });
  }
}

async function selectSession(sessionId) {
  state.activeSessionId = sessionId;
  renderSessionList();
  if (!sessionId) {
    els.emptyState.classList.remove('hidden');
    els.sessionDetail.classList.add('hidden');
    return;
  }

  try {
    const detail = await apiGet('/session?sessionId=' + encodeURIComponent(sessionId));
    state.activeDetail = detail;
    els.emptyState.classList.add('hidden');
    els.sessionDetail.classList.remove('hidden');
    renderSessionDetail(detail);
  } catch (err) {
    showToast(t('errReadSession', { err: err.message }), true);
  }
}

function renderSessionDetail(detail) {
  els.detailTitleInput.value = detail.title || '';

  els.detailMeta.innerHTML = '';
  const addMeta = (label, codeText) => {
    const span = document.createElement('span');
    span.textContent = label + ' ';
    const code = document.createElement('code');
    code.textContent = codeText;
    span.appendChild(code);
    els.detailMeta.appendChild(span);
  };

  addMeta(t('metaSessionId'), detail.sessionId);
  addMeta(t('metaPreset'), detail.header?.agentPreset || 'standard');
  addMeta(t('metaEvents'), t('metaEventsVal', { count: detail.totalEvents }));
  addMeta(t('metaDiskSize'), formatBytes(detail.disk?.totalBytes || 0));
  if (detail.disk?.primaryLogFile) {
    addMeta(t('metaLogPath'), detail.disk.primaryLogFile);
  }
  if (detail.attachments?.length) {
    addMeta(t('metaAttachments'), t('metaAttachmentsVal', { count: detail.attachments.length }));
  }

  els.turnsContainer.innerHTML = '';
  if (els.turnNavBar) {
    els.turnNavBar.innerHTML = '';
  }
  const turns = detail.turns || [];
  if (turns.length === 0) {
    if (els.turnNavBar) {
      els.turnNavBar.classList.add('hidden');
    }
    const emptyTurn = document.createElement('div');
    emptyTurn.style.padding = '28px';
    emptyTurn.style.textAlign = 'center';
    emptyTurn.style.color = 'var(--text-muted)';
    emptyTurn.textContent = t('emptyTurnsHint');
    els.turnsContainer.appendChild(emptyTurn);
    return;
  }

  if (els.turnNavBar) {
    els.turnNavBar.classList.remove('hidden');
    const navLabel = document.createElement('span');
    navLabel.className = 'turn-nav-label';
    navLabel.textContent = t('turnNavLabel', { count: turns.length });
    els.turnNavBar.appendChild(navLabel);
    for (const turnItem of turns) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'turn-nav-pill';
      pill.textContent = turnItem.toolCallsCount > 0
        ? t('turnNavPillTools', { turn: turnItem.turn, tools: turnItem.toolCallsCount })
        : t('turnNavPill', { turn: turnItem.turn });
      pill.onclick = () => {
        const target = document.getElementById(`turn-card-${turnItem.turn}`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.remove('highlight-jump');
        void target.offsetWidth;
        target.classList.add('highlight-jump');
        setTimeout(() => target.classList.remove('highlight-jump'), 1200);
      };
      els.turnNavBar.appendChild(pill);
    }
  }

  const inlineThinkingRe = /<(?:thinking|[a-z0-9_-]*thinking)>/i;

  for (let tIdx = 0; tIdx < turns.length; tIdx++) {
    const turnObj = turns[tIdx];
    const card = document.createElement('div');
    card.className = 'turn-card';
    card.id = `turn-card-${turnObj.turn}`;
    card.dataset.turn = String(turnObj.turn);

    const head = document.createElement('div');
    head.className = 'turn-card-header';

    const tTitle = document.createElement('div');
    tTitle.className = 'turn-title';
    tTitle.textContent = t('turnCardTitle', { turn: turnObj.turn });
    const seqSpan = document.createElement('span');
    seqSpan.className = 'badge';
    seqSpan.textContent = `seq ${turnObj.startSeq}–${turnObj.endSeq} · ${formatTime(turnObj.time)}`;
    tTitle.appendChild(seqSpan);
    if (turnObj.toolCallsCount > 0) {
      const toolB = document.createElement('span');
      toolB.className = 'badge';
      toolB.textContent = t('badgeToolCalls', { count: turnObj.toolCallsCount });
      tTitle.appendChild(toolB);
    }
    if (turnObj.status && turnObj.status !== 'completed' && turnObj.status !== 'open') {
      const errB = document.createElement('span');
      errB.className = 'badge badge-orphan';
      errB.title = turnObj.errorReason || turnObj.status;
      errB.textContent = `⚠️ ${turnObj.status}`;
      tTitle.appendChild(errB);
    }

    const tActions = document.createElement('div');
    tActions.className = 'turn-actions';

    const btnDelTurn = document.createElement('button');
    btnDelTurn.type = 'button';
    btnDelTurn.className = 'btn btn-ghost btn-xs';
    btnDelTurn.textContent = t('btnDeleteTurn');
    btnDelTurn.onclick = async () => {
      const ok = await askConfirm(
        t('confirmDeleteTurnTitle', { turn: turnObj.turn }),
        t('confirmDeleteTurnMsg', { turn: turnObj.turn }),
        t('confirmDeleteTurnBtn')
      );
      if (!ok) return;
      try {
        await apiPost('/delete-turns', { sessionId: detail.sessionId, turns: [turnObj.turn] });
        showToast(t('toastTurnDeleted', { turn: turnObj.turn }));
        await selectSession(detail.sessionId);
        await loadSessionsSummary();
      } catch (err) {
        showToast(t('errDeleteTurn', { err: err.message }), true);
      }
    };
    tActions.appendChild(btnDelTurn);

    if (tIdx < turns.length - 1) {
      const laterTurns = turns.slice(tIdx).map(x => x.turn);
      const btnTrunc = document.createElement('button');
      btnTrunc.type = 'button';
      btnTrunc.className = 'btn btn-ghost btn-xs';
      btnTrunc.textContent = t('btnTruncateFrom', { turn: turnObj.turn, count: laterTurns.length });
      btnTrunc.onclick = async () => {
        const ok = await askConfirm(
          t('confirmTruncateTitle'),
          t('confirmTruncateMsg', { turn: turnObj.turn, count: laterTurns.length }),
          t('confirmTruncateBtn')
        );
        if (!ok) return;
        try {
          await apiPost('/delete-turns', { sessionId: detail.sessionId, turns: laterTurns });
          showToast(t('toastTruncated', { count: laterTurns.length }));
          await selectSession(detail.sessionId);
          await loadSessionsSummary();
        } catch (err) {
          showToast(t('errTruncate', { err: err.message }), true);
        }
      };
      tActions.appendChild(btnTrunc);
    }

    head.append(tTitle, tActions);

    const body = document.createElement('div');
    body.className = 'turn-body';

    for (const item of turnObj.items) {
      const toolPills = item.blocks.filter(b => b.type === 'tool_use');
      if (toolPills.length > 0) {
        const pillRow = document.createElement('div');
        pillRow.className = 'tool-pill-row';
        pillRow.textContent = t('stepToolsPrefix') + toolPills.map(p => p.toolName).join(', ');
        body.appendChild(pillRow);
      }

      for (const b of item.blocks) {
        if (!b.editable) continue;
        const isReasoning = b.type === 'reasoning' || b.type === 'thinking';
        const isToolEmptyText = toolPills.length > 0 && item.role === 'assistant' && !isReasoning && !(b.text || '').trim();
        const msgBox = document.createElement('div');
        const kindClass = item.role === 'user' ? 'role-user' : (isReasoning ? 'role-reasoning' : 'role-assistant');
        msgBox.className = 'msg-block ' + kindClass + (isToolEmptyText ? ' compact-empty' : '');
        msgBox.dataset.eventSeq = String(item.eventSeq);
        msgBox.dataset.blockIndex = String(b.blockIndex);

        const mHead = document.createElement('div');
        mHead.className = 'msg-block-head';

        const roleTag = document.createElement('span');
        roleTag.className = 'msg-role-tag';
        const updateRoleTag = () => {
          if (item.role === 'user') {
            roleTag.textContent = t('roleUserTag', { seq: item.eventSeq });
          } else if (isReasoning) {
            roleTag.textContent = t('roleReasoningTag', { model: item.model || 'assistant', seq: item.eventSeq });
          } else {
            const inlineNote = inlineThinkingRe.test(b.text || '') ? t('inlineThinkingSuffix') : '';
            roleTag.textContent = t('roleAssistantTag', {
              model: item.model || 'assistant',
              seq: item.eventSeq,
              inline: inlineNote,
            });
          }
        };
        updateRoleTag();

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn btn-ghost btn-xs';
        btnEdit.textContent = t('btnEditInPlace');

        mHead.append(roleTag, btnEdit);

        const formatViewText = (val) => {
          if (val) return val;
          if (toolPills.length > 0 && item.role === 'assistant' && !isReasoning) {
            return t('emptyToolStepText');
          }
          return t('emptyContentText');
        };

        const textView = document.createElement('div');
        textView.className = 'msg-text-view';
        textView.title = t('tipDoubleClickEdit');
        textView.textContent = formatViewText(b.text);

        const editorBox = document.createElement('div');
        editorBox.className = 'msg-editor-box hidden';

        const textarea = document.createElement('textarea');
        textarea.className = 'textarea msg-editor-textarea';
        textarea.value = b.text;

        const edActions = document.createElement('div');
        edActions.className = 'msg-editor-actions';

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'btn btn-ghost btn-sm';
        btnCancel.textContent = t('btnCancel');

        const btnSave = document.createElement('button');
        btnSave.type = 'button';
        btnSave.className = 'btn btn-primary btn-sm';
        btnSave.textContent = t('btnSaveEdit');

        const openEditor = () => {
          textarea.value = b.text;
          textView.classList.add('hidden');
          btnEdit.classList.add('hidden');
          editorBox.classList.remove('hidden');
          msgBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          textarea.focus();
        };

        btnEdit.onclick = openEditor;
        textView.ondblclick = openEditor;

        btnCancel.onclick = () => {
          editorBox.classList.add('hidden');
          textView.classList.remove('hidden');
          btnEdit.classList.remove('hidden');
        };

        btnSave.onclick = async () => {
          btnSave.disabled = true;
          btnSave.textContent = t('btnSaving');
          try {
            await apiPost('/edit-message', {
              sessionId: detail.sessionId,
              eventSeq: item.eventSeq,
              blockIndex: b.blockIndex,
              text: textarea.value,
            });
            b.text = textarea.value;
            textView.textContent = formatViewText(b.text);
            updateRoleTag();
            const nowEmptyToolText = toolPills.length > 0 && item.role === 'assistant' && !isReasoning && !(b.text || '').trim();
            msgBox.classList.toggle('compact-empty', nowEmptyToolText);
            editorBox.classList.add('hidden');
            textView.classList.remove('hidden');
            btnEdit.classList.remove('hidden');
            showToast(t('toastMsgSaved'));
            await loadSessionsSummary();
          } catch (err) {
            showToast(t('errSaveEdit', { err: err.message }), true);
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = t('btnSaveEdit');
          }
        };

        edActions.append(btnCancel, btnSave);
        editorBox.append(textarea, edActions);
        msgBox.append(mHead, textView, editorBox);
        body.appendChild(msgBox);
      }
    }

    card.append(head, body);
    els.turnsContainer.appendChild(card);
  }
}

async function handleDeleteSessions(sessionIds, labelDesc) {
  if (!sessionIds.length) return;
  const ok = await askConfirm(
    t('confirmDelSessionsTitle'),
    t('confirmDelSessionsMsg', { target: labelDesc }),
    t('confirmDelSessionsBtn', { count: sessionIds.length })
  );
  if (!ok) return;

  try {
    const res = await apiPost('/delete-sessions', { sessionIds });
    for (const id of sessionIds) state.selectedIds.delete(id);
    if (sessionIds.includes(state.activeSessionId)) {
      state.activeSessionId = '';
      state.activeDetail = null;
      els.sessionDetail.classList.add('hidden');
      els.emptyState.classList.remove('hidden');
    }
    await loadSessionsSummary();
    showToast(t('toastDeletedSessions', {
      count: res.deletedCount,
      size: formatBytes(res.freedBytes),
    }));
  } catch (err) {
    showToast(t('errDeleteSessions', { err: err.message }), true);
  }
}

// Language switcher bindings
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
});

// Event bindings
els.btnToggleSidebar.onclick = () => {
  els.sidebar.classList.toggle('collapsed');
};

if (viewKind === 'conversation' && initialSessionId) {
  if (window.innerWidth < 960) {
    els.sidebar.classList.add('collapsed');
  }
}

els.btnRefreshList.onclick = async () => {
  await loadSessionsSummary();
  if (state.activeSessionId) await selectSession(state.activeSessionId);
};

els.searchInput.oninput = () => {
  state.searchQuery = els.searchInput.value;
  renderSessionList();
};

els.workspaceFilter.onchange = () => {
  state.workspaceFilter = els.workspaceFilter.value;
  renderSessionList();
};

els.checkAll.onchange = () => {
  for (const s of state.filteredSessions) {
    if (els.checkAll.checked) state.selectedIds.add(s.sessionId);
    else state.selectedIds.delete(s.sessionId);
  }
  renderSessionList();
};

els.btnBatchDelete.onclick = async () => {
  const ids = [...state.selectedIds];
  await handleDeleteSessions(ids, t('targetBatchCount', { count: ids.length }));
};

els.btnCleanEmpty.onclick = async () => {
  const emptyIds = (state.summary?.sessions ?? []).filter(s => s.turnCount === 0).map(s => s.sessionId);
  if (emptyIds.length === 0) {
    showToast(t('toastNoEmptySessions'));
    return;
  }
  await handleDeleteSessions(emptyIds, t('targetEmptyCount', { count: emptyIds.length }));
};

els.btnDeleteCurrent.onclick = async () => {
  if (!state.activeSessionId) return;
  const title = els.detailTitleInput.value || state.activeSessionId;
  await handleDeleteSessions([state.activeSessionId], t('targetSingleSession', { title }));
};

els.btnSaveTitle.onclick = async () => {
  if (!state.activeSessionId) return;
  const newTitle = els.detailTitleInput.value.trim();
  if (!newTitle) {
    showToast(t('toastNeedNonEmptyTitle'), true);
    return;
  }
  try {
    await apiPost('/rename', { sessionId: state.activeSessionId, title: newTitle });
    showToast(t('toastTitleSaved'));
    await loadSessionsSummary();
  } catch (err) {
    showToast(t('errRename', { err: err.message }), true);
  }
};

els.btnReloadHost.onclick = () => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'session-manager:reload-host', sessionId: state.activeSessionId }, window.location.origin);
  } else {
    window.location.reload();
  }
};

els.btnAppendTurn.onclick = async () => {
  if (!state.activeSessionId) return;
  const userText = els.appendUser.value.trim();
  const reasoningText = els.appendReasoning.value.trim();
  const assistantText = els.appendAssistant.value.trim();
  if (!userText || !assistantText) {
    showToast(t('toastNeedAppendFields'), true);
    return;
  }
  els.btnAppendTurn.disabled = true;
  try {
    await apiPost('/append-turn', {
      sessionId: state.activeSessionId,
      userText,
      reasoningText,
      assistantText,
    });
    els.appendUser.value = '';
    els.appendReasoning.value = '';
    els.appendAssistant.value = '';
    els.appendDetails.open = false;
    showToast(t('toastTurnAppended'));
    await selectSession(state.activeSessionId);
    await loadSessionsSummary();
  } catch (err) {
    showToast(t('errAppendTurn', { err: err.message }), true);
  } finally {
    els.btnAppendTurn.disabled = false;
  }
};

// Initial boot (Defaults to EN unless user chose 中文 or 日本語)
applyStaticTranslations();
await loadSessionsSummary();
if (initialSessionId) {
  await selectSession(initialSessionId);
}
