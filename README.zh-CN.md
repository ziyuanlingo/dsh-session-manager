# 🗂️ dsh-session-manager

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

**面向 DeepSeek Harness (DSH `v0.2.x` / `v4` Zstd 日志格式) 的原地会话内容编辑、轮次裁剪与真物理存储清理插件**

[![Version](https://img.shields.io/badge/Version-v1.0.3-ec6aa0.svg)](https://github.com/ziyuanlingo/dsh-session-manager/releases/tag/v1.0.3)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![DSH Compatibility](https://img.shields.io/badge/DSH-%3E%3D0.1.0--0%20%3C1.0.0-ff69b4.svg)](https://github.com/ziyuanlingo/dsh-session-manager)

---

## 简介

在 DeepSeek Harness（DSH `0.2.x`）的多轮文档翻译工作台与长程 Agent 研发流程中，默认会话机制仅支持追加事件与逻辑归档（Archive），存在两大长期痛点：
1. **无法真正删除会话与磁盘文件**：归档仅隐藏侧边栏条目，`data/dsh/sessions/` 下的多帧 Zstandard 日志（`session.v4.jsonl.zstd`）、`session_projcache` 投影快照以及上传附件依然长期占用磁盘；
2. **传统分支式编辑产生大量冗余副本**：旧版第三方消息编辑插件不仅因依赖已移除的前端内部 Store 包在 DSH `0.2.1+` 崩溃，且每次微调一句话都会克隆出一个全新的会话 ID，导致侧边栏迅速堆积大量历史分支垃圾。

**`dsh-session-manager` (`v1.0.3`)** 提供 **100% 原地无损修改会话内容（In-Place Lossless Rewrite）** 与 **六步彻底物理级清理（True Physical Deletion）**，零外部运行时依赖（直接利用 Node.js 22+ 原生 Zstandard 能力与 DSH 官方 `Session.prepare` 双模式契约预校验），并配备支持 **`EN | 中文 | 日本語` 实时切换的三语可视化工作台**，同时挂载在左侧边栏面板与每个对话顶部的标签页中。

---

## 核心功能

### 1. 🗑️ 六步彻底物理级删除（单删 / 多选批量删 / 一键清空 0 轮空会话）
执行删除时，插件按严格顺序完成全链路清理：
1. **安全停止并释放文件锁**：若目标会话正处于运行或内存挂载态，自动取消当前轮次、排空并关闭 `JsonlSessionHandle` 写句柄（释放 Windows/POSIX `SessionWriteLease` 锁），并从 `agents` 与 `sessions` 注册表中干净解绑；
2. **工作区实时解绑（侧边栏即时消失）**：从 `workspaceRegistry` 所属工作区调用 `detachSession`、移除置顶（Pin）与归档（Archive）记录，实时同步更新前端左侧列表；
3. **物理清除会话日志目录**：彻底删除 `data/dsh/sessions/<workspace-slug>/<sessionId>/` 文件夹及其内部的 `session.v4.jsonl.zstd` 多帧压缩日志（若父目录已空亦自动回收）；
4. **清除投影与查询缓存**：删除 `data/dsh/storages/session_projcache/sessions/<sessionId>.json` 文件及内存投影表、`coldLogMemo` 与 `sessionQuery` 观察缓存；
5. **孤儿上传附件智能回收**：自动扫描被删会话事件中引用的 SHA-256 附件 ID，核对其余存活会话是否仍引用该附件；若已无任何引用，物理删除 `data/dsh/attachments/v1/` 下的对应文件；
6. **预设插件状态同步清理**：若环境安装了 `dsh-preset-enhance`，自动清理其 `state.json` 中残留的 `bindings[sessionId]` 与 `sessions[sessionId]` 缓存。

### 2. ✏️ 原地无损修改会话内容（零副本垃圾）
所有编辑均直接作用于**原会话 ID**，保持工作区位置、工具调用上下文与预设绑定不变：
- **原地修改任意消息块与思考块**：直接编辑任意回合的用户输入（`user/message`）、思考链（`assistant.reasoning` / `assistant.thinking`，无损保留原字段结构）或助手正文回复（`assistant.text`）；支持点击右上角 **「✏️ 原地编辑」** 或直接**双击消息正文**进入编辑态；
- **多轮长会话快速跳转与完整滚动**：顶部配备 **⚡ 轮次直达导航胶囊**，一键平滑定位至任意中间回合；具备完整的 Flexbox 防挤压保护，确保窄屏与多轮长会话下所有思考块与操作按钮完整可点；
- **原地删除指定回合 / 向后截断**：支持单轮移除或从第 $N$ 轮起向后截断；自动成对剥离前置 `agent/inbox/spliced` 事件，并将保留事件重排为连续的 `seq = 0..N-1` 与 `turn = 1..K`，同步修正 `messageSeqs` / `sourceEventSeqs` 引用；
- **原地修改标题与末尾追加回合**：支持直接更新 `session/title` 或在会话末尾原地追加一轮完整的 `User + Reasoning (选填) + Assistant` 对话。

### 3. 🛡️ 双重契约预校验与多帧 Zstd 原子替换
- **落盘前双模式重放预校验**：任何原地修改在接触磁盘前，均使用独立临时 ID 同时通过宿主 `Session.create`（内存快照）与 `Session.fromRestore`（`detached` 冷恢复）双重校验，并自动维护 `isSeeded: true` 继承会话的 `inheritedEventCount` 与 `session/end-seed` 游标对齐；
- **多帧 Zstandard 原子替换**：优先调用宿主 `sessionPersistence.encodeMaterialization()`（内置带校验和双帧原生 Zstd 编码器兜底），先写入同目录临时文件完成 `fsync()`，再通过原子 `rename()` 覆盖目标日志。

### 4. 🌐 默认英文 + 右上角 `EN | 中文 | 日本語` 三语实时切换工作台
- 默认呈现简洁的英文界面，右上角常驻 **`EN | 中文 | 日本語`** 切换胶囊，点击即可零刷新实时切换全部导航、筛选器、轮次卡片、角色标签与确认弹窗文案。

---

## 安装指南

### 方式一：通过 DSH CLI 从 GitHub 直接安装

```bash
dsh plugin --profile web add github:ziyuanlingo/dsh-session-manager
```

### 方式二：克隆到本地目录并通过 `link:` 挂载

1. 将仓库克隆至本地 `plugins/` 目录：
   ```bash
   git clone https://github.com/ziyuanlingo/dsh-session-manager.git plugins/dsh-session-manager
   ```

2. 在 Web Profile 的 `package.json` 中添加链接依赖（或执行 `dsh plugin --profile web add -w link:./plugins/dsh-session-manager`）：
   ```json
   {
     "dependencies": {
       "dsh-session-manager": "link:./plugins/dsh-session-manager"
     }
   }
   ```

3. 在 `cordis.patch.yml` 中启用插件：
   ```yaml
   - insert:
       - id: session-manager
         name: 'dsh-session-manager'
   ```

4. 重启 DSH Web 服务并刷新浏览器页面即可生效。

---

## 使用说明

插件加载后，在 DSH Web 界面提供**两个入口**：
1. **全局会话管理面板（左侧边栏）**：点击左侧工具栏的 **「Session Manager / 会话全权管家」** 图标，按标题/ID/目录搜索，按工作区、**0轮空会话**或**未归属孤儿会话**筛选，支持多选批量彻底删除或一键清空全部 0 轮空会话。
2. **单会话快速编辑（对话顶部标签栏）**：在任意对话顶部点击 **「Session Editor / 会话编辑/删除」** 标签页，通过顶部轮次胶囊快速跳转、双击正文原地修改保存、裁剪废轮次，并点击 **「✨ 同步刷新主界面」** 即时刷新主聊天视图。

---

## HTTP 接口参考

所有接口均挂载于宿主同源 `webServer` 的 `/session-manager` 前缀下：

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/session-manager` | 渲染支持 `EN` / `中文` / `日本語` 实时切换的会话管理工作台 |
| `GET` | `/session-manager/api/sessions` | 聚合全部工作区/孤儿会话、内存状态与磁盘字节占用统计 |
| `GET` | `/session-manager/api/session?sessionId=<id>` | 读取单个会话的完整头部、结构化回合、可编辑消息块与附件列表 |
| `POST` | `/session-manager/api/rename` | 原地更新指定会话标题（`{ sessionId, title }`） |
| `POST` | `/session-manager/api/edit-message` | 原地修改指定消息块或思考块文本（`{ sessionId, eventSeq, blockIndex, text }`） |
| `POST` | `/session-manager/api/delete-turns` | 原地移除指定回合数组并自动重排序号（`{ sessionId, turns: number[] }`） |
| `POST` | `/session-manager/api/append-turn` | 在会话末尾原地追加一轮完整对话（`{ sessionId, userText, reasoningText?, assistantText }`） |
| `POST` | `/session-manager/api/delete-sessions` | 彻底物理删除一个或多个会话及全部关联文件（`{ sessionIds: string[] }`） |

---

## 更新日志

### `v1.0.3`
- **新增英/中/日（`EN | 中文 | 日本語`）实时三语切换 Web UI**：默认英文界面，右上角常驻三语切换器（无论是否选中会话均随时可切），并与外层 DSH 侧边栏及会话标签页联动。
- **后端无标题与孤儿标记语言中性化**：规范化空标题会话与孤儿工作区的结构标识，确保切换语言时列表与详情无残留硬编码文案。

### `v1.0.2`
- **修复多轮对话中间回合被 Flexbox 裁剪问题**：补齐 `.turn-card` 与弹性容器的 `flex-shrink: 0`、`overflow: visible` 与 `min-height: 0` 滚动链，防止长模型名挤压编辑按钮。
- **新增轮次直达胶囊与 `thinking` 块无损写回**：支持顶部 **⚡ 轮次直达** 快速定位、双击正文进入编辑态以及 `.thinking` / `.text` 思考块无损往返保存。

---

## 开发与测试

要求 Node.js `>= 22.0.0`：

```bash
npm run check
npm test
```

---

## 开源许可

本项目采用 [MIT License](./LICENSE) 开源许可协议。
