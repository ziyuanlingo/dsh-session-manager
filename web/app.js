const API_BASE = '/session-manager/api';

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

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTime(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '-';
  }
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

function askConfirm(title, message, confirmLabel = '确认彻底删除') {
  return new Promise((resolve) => {
    els.modalTitle.textContent = title;
    els.modalMessage.textContent = message;
    els.modalConfirm.textContent = confirmLabel;
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
      s.title.toLowerCase().includes(q) ||
      s.sessionId.toLowerCase().includes(q) ||
      (s.cwd || '').toLowerCase().includes(q) ||
      (s.workspaceTitle || '').toLowerCase().includes(q)
    );
  });
}

function updateBatchControls() {
  const count = state.selectedIds.size;
  els.btnBatchDelete.textContent = `🗑️ 彻底删除选中 (${count})`;
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

  addOpt('__all__', `📂 全部会话 (${state.summary?.totalSessions ?? 0})`);
  addOpt('__empty__', `🧹 0轮空会话 (${state.summary?.emptyCount ?? 0})`);
  if ((state.summary?.orphanCount ?? 0) > 0) {
    addOpt('__orphan__', `👻 未归属孤儿会话 (${state.summary.orphanCount})`);
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
    els.globalStats.textContent = `共 ${state.summary.totalSessions} 个会话 · 磁盘占用 ${formatBytes(state.summary.totalBytes)} · 空会话 ${state.summary.emptyCount} 个`;
  }

  if (state.filteredSessions.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '20px';
    empty.style.textAlign = 'center';
    empty.style.color = 'var(--text-muted)';
    empty.textContent = '当前筛选条件下没有会话。';
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

    const titleEl = document.createElement('div');
    titleEl.className = 'session-item-title';
    titleEl.textContent = (s.isPinned ? '📌 ' : '') + s.title;

    const sub = document.createElement('div');
    sub.className = 'session-item-sub';

    const turnBadge = document.createElement('span');
    turnBadge.className = 'badge' + (s.turnCount === 0 ? ' badge-empty' : '');
    turnBadge.textContent = `${s.turnCount} 轮`;
    sub.appendChild(turnBadge);

    const sizeBadge = document.createElement('span');
    sizeBadge.className = 'badge';
    sizeBadge.textContent = formatBytes(s.totalBytes);
    sub.appendChild(sizeBadge);

    if (s.isLive) {
      const liveB = document.createElement('span');
      liveB.className = 'badge badge-live';
      liveB.textContent = s.isRunning ? '运行中' : '内存中';
      sub.appendChild(liveB);
    }
    if (s.isOrphan) {
      const orpB = document.createElement('span');
      orpB.className = 'badge badge-orphan';
      orpB.textContent = '孤儿文件';
      sub.appendChild(orpB);
    }

    const wsSpan = document.createElement('span');
    wsSpan.textContent = s.workspaceTitle;
    sub.appendChild(wsSpan);

    body.append(titleEl, sub);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost session-item-del';
    delBtn.title = '彻底物理删除此会话及磁盘文件';
    delBtn.textContent = '🗑️';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      await handleDeleteSessions([s.sessionId], `「${s.title}」`);
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
    // Prune selectedIds that no longer exist
    const validIds = new Set(state.summary.sessions.map(s => s.sessionId));
    for (const id of [...state.selectedIds]) {
      if (!validIds.has(id)) state.selectedIds.delete(id);
    }
    renderWorkspaceOptions();
    renderSessionList();
  } catch (err) {
    els.globalStats.textContent = '加载失败：' + err.message;
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
    showToast('读取会话详情失败：' + err.message, true);
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

  addMeta('会话 ID:', detail.sessionId);
  addMeta('模式:', detail.header?.agentPreset || 'standard');
  addMeta('总事件数:', `${detail.totalEvents} 条`);
  addMeta('物理占用:', formatBytes(detail.disk?.totalBytes || 0));
  if (detail.disk?.primaryLogFile) {
    addMeta('磁盘日志:', detail.disk.primaryLogFile);
  }
  if (detail.attachments?.length) {
    addMeta('关联附件:', `${detail.attachments.length} 个`);
  }

  els.turnsContainer.innerHTML = '';
  const turns = detail.turns || [];
  if (turns.length === 0) {
    const emptyTurn = document.createElement('div');
    emptyTurn.style.padding = '28px';
    emptyTurn.style.textAlign = 'center';
    emptyTurn.style.color = 'var(--text-muted)';
    emptyTurn.textContent = '当前会话还没有任何对话回合（0 轮空会话），可以在下方手动追加对话，或直接彻底删除此空会话。';
    els.turnsContainer.appendChild(emptyTurn);
    return;
  }

  for (let tIdx = 0; tIdx < turns.length; tIdx++) {
    const t = turns[tIdx];
    const card = document.createElement('div');
    card.className = 'turn-card';

    const head = document.createElement('div');
    head.className = 'turn-card-header';

    const tTitle = document.createElement('div');
    tTitle.className = 'turn-title';
    tTitle.textContent = `第 ${t.turn} 轮对话`;
    const seqSpan = document.createElement('span');
    seqSpan.className = 'badge';
    seqSpan.textContent = `seq ${t.startSeq}–${t.endSeq} · ${formatTime(t.time)}`;
    tTitle.appendChild(seqSpan);
    if (t.toolCallsCount > 0) {
      const toolB = document.createElement('span');
      toolB.className = 'badge';
      toolB.textContent = `🔧 工具调用 ×${t.toolCallsCount}`;
      tTitle.appendChild(toolB);
    }
    if (t.status && t.status !== 'completed' && t.status !== 'open') {
      const errB = document.createElement('span');
      errB.className = 'badge badge-orphan';
      errB.title = t.errorReason || t.status;
      errB.textContent = `⚠️ ${t.status}`;
      tTitle.appendChild(errB);
    }

    const tActions = document.createElement('div');
    tActions.className = 'turn-actions';

    const btnDelTurn = document.createElement('button');
    btnDelTurn.className = 'btn btn-ghost btn-xs';
    btnDelTurn.textContent = '✂️ 删除本轮';
    btnDelTurn.onclick = async () => {
      const ok = await askConfirm(
        `删除第 ${t.turn} 轮对话`,
        `确定要从当前会话中原地移除第 ${t.turn} 轮对话吗？\n后续回合将自动重排连续序号并保留，不会产生新会话副本。`,
        '确认删除本轮'
      );
      if (!ok) return;
      try {
        await apiPost('/delete-turns', { sessionId: detail.sessionId, turns: [t.turn] });
        showToast(`✅ 已原地移除第 ${t.turn} 轮对话并更新磁盘文件！可点右上角「同步刷新主界面」查看最新对话。`);
        await selectSession(detail.sessionId);
        await loadSessionsSummary();
      } catch (err) {
        showToast('删除本轮失败：' + err.message, true);
      }
    };
    tActions.appendChild(btnDelTurn);

    if (tIdx < turns.length - 1) {
      const laterTurns = turns.slice(tIdx).map(x => x.turn);
      const btnTrunc = document.createElement('button');
      btnTrunc.className = 'btn btn-ghost btn-xs';
      btnTrunc.textContent = `⏭️ 从第 ${t.turn} 轮起向后截断 (${laterTurns.length}轮)`;
      btnTrunc.onclick = async () => {
        const ok = await askConfirm(
          '向后截断对话历史',
          `确定要删除第 ${t.turn} 轮至最后一轮（共 ${laterTurns.length} 轮）的所有内容，将对话回退到第 ${t.turn} 轮之前吗？`,
          '确认截断'
        );
        if (!ok) return;
        try {
          await apiPost('/delete-turns', { sessionId: detail.sessionId, turns: laterTurns });
          showToast(`✅ 已成功截断移除后 ${laterTurns.length} 轮对话！`);
          await selectSession(detail.sessionId);
          await loadSessionsSummary();
        } catch (err) {
          showToast('截断失败：' + err.message, true);
        }
      };
      tActions.appendChild(btnTrunc);
    }

    head.append(tTitle, tActions);

    const body = document.createElement('div');
    body.className = 'turn-body';

    for (const item of t.items) {
      const toolPills = item.blocks.filter(b => b.type === 'tool_use');
      if (toolPills.length > 0) {
        const pillRow = document.createElement('div');
        pillRow.className = 'tool-pill-row';
        pillRow.textContent = '🔧 本步调用工具：' + toolPills.map(p => p.toolName).join('、');
        body.appendChild(pillRow);
      }

      for (const b of item.blocks) {
        if (!b.editable) continue;
        const msgBox = document.createElement('div');
        const kindClass = item.role === 'user' ? 'role-user' : (b.type === 'reasoning' ? 'role-reasoning' : 'role-assistant');
        msgBox.className = 'msg-block ' + kindClass;

        const mHead = document.createElement('div');
        mHead.className = 'msg-block-head';

        const roleTag = document.createElement('span');
        roleTag.className = 'msg-role-tag';
        if (item.role === 'user') {
          roleTag.textContent = `👤 用户输入 (seq=${item.eventSeq})`;
        } else if (b.type === 'reasoning') {
          roleTag.textContent = `💭 思考链 Reasoning (${item.model || 'assistant'} · seq=${item.eventSeq})`;
        } else {
          roleTag.textContent = `🎀 助手正文回复 (${item.model || 'assistant'} · seq=${item.eventSeq})`;
        }

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-ghost btn-xs';
        btnEdit.textContent = '✏️ 原地编辑';

        mHead.append(roleTag, btnEdit);

        const textView = document.createElement('div');
        textView.className = 'msg-text-view';
        textView.textContent = b.text || '（空内容）';

        const editorBox = document.createElement('div');
        editorBox.className = 'msg-editor-box hidden';

        const textarea = document.createElement('textarea');
        textarea.className = 'textarea msg-editor-textarea';
        textarea.value = b.text;

        const edActions = document.createElement('div');
        edActions.className = 'msg-editor-actions';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn-ghost btn-sm';
        btnCancel.textContent = '取消';

        const btnSave = document.createElement('button');
        btnSave.className = 'btn btn-primary btn-sm';
        btnSave.textContent = '💾 原地保存修改';

        btnEdit.onclick = () => {
          textarea.value = b.text;
          textView.classList.add('hidden');
          btnEdit.classList.add('hidden');
          editorBox.classList.remove('hidden');
          textarea.focus();
        };

        btnCancel.onclick = () => {
          editorBox.classList.add('hidden');
          textView.classList.remove('hidden');
          btnEdit.classList.remove('hidden');
        };

        btnSave.onclick = async () => {
          btnSave.disabled = true;
          btnSave.textContent = '保存中…';
          try {
            await apiPost('/edit-message', {
              sessionId: detail.sessionId,
              eventSeq: item.eventSeq,
              blockIndex: b.blockIndex,
              text: textarea.value,
            });
            b.text = textarea.value;
            textView.textContent = b.text || '（空内容）';
            editorBox.classList.add('hidden');
            textView.classList.remove('hidden');
            btnEdit.classList.remove('hidden');
            showToast('✅ 消息内容已原地无损写回会话文件！点击右上角「✨ 同步刷新主界面」即可在聊天窗看到更新。');
            await loadSessionsSummary();
          } catch (err) {
            showToast('保存修改失败：' + err.message, true);
          } finally {
            btnSave.disabled = false;
            btnSave.textContent = '💾 原地保存修改';
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
    '🗑️ 彻底物理删除会话及关联文件',
    `确定要彻底删除 ${labelDesc} 吗？\n\n此操作将同时清理：\n1. 工作区侧边栏记录与内存活跃实例\n2. 磁盘会话文件夹与 session.v4.jsonl.zstd 日志\n3. 投影缓存文件 (.json) 与预设绑定记录\n4. 不再被其他会话引用的专属上传附件\n\n物理删除后不可恢复！`,
    `确认彻底删除 (${sessionIds.length})`
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
    showToast(`✅ 已彻底物理删除 ${res.deletedCount} 个会话，释放磁盘空间 ${formatBytes(res.freedBytes)}！左侧边栏已实时同步移除。`);
  } catch (err) {
    alert('删除失败：' + err.message);
  }
}

// Event bindings
els.btnToggleSidebar.onclick = () => {
  els.sidebar.classList.toggle('collapsed');
};

if (viewKind === 'conversation' && initialSessionId) {
  // In per-conversation tab mode, keep sidebar collapsible so current conversation gets maximum width, or keep open if wide
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
  await handleDeleteSessions(ids, `选中的 ${ids.length} 个会话`);
};

els.btnCleanEmpty.onclick = async () => {
  const emptyIds = (state.summary?.sessions ?? []).filter(s => s.turnCount === 0).map(s => s.sessionId);
  if (emptyIds.length === 0) {
    showToast('当前没有任何 0 轮空会话需要清理。');
    return;
  }
  await handleDeleteSessions(emptyIds, `全部 ${emptyIds.length} 个 0 轮空会话`);
};

els.btnDeleteCurrent.onclick = async () => {
  if (!state.activeSessionId) return;
  const title = els.detailTitleInput.value || state.activeSessionId;
  await handleDeleteSessions([state.activeSessionId], `当前会话「${title}」`);
};

els.btnSaveTitle.onclick = async () => {
  if (!state.activeSessionId) return;
  const newTitle = els.detailTitleInput.value.trim();
  if (!newTitle) {
    showToast('请输入非空的会话标题。', true);
    return;
  }
  try {
    await apiPost('/rename', { sessionId: state.activeSessionId, title: newTitle });
    showToast('✅ 会话标题已原地更新保存！');
    await loadSessionsSummary();
  } catch (err) {
    showToast('重命名失败：' + err.message, true);
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
    showToast('请填写完整的用户消息内容与助手回复正文。', true);
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
    showToast('✅ 新的一轮对话已原地写入会话末尾！');
    await selectSession(state.activeSessionId);
    await loadSessionsSummary();
  } catch (err) {
    showToast('追加失败：' + err.message, true);
  } finally {
    els.btnAppendTurn.disabled = false;
  }
};

// Initial boot
await loadSessionsSummary();
if (initialSessionId) {
  await selectSession(initialSessionId);
}
