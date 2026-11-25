# dsh-session-manager

**In-Place Session Editor, Turn Trimmer & True Physical Storage Cleaner for DeepSeek Harness (DSH)**  
**面向 DeepSeek Harness (DSH `v0.2.x` / `v4` 日志格式) 的原地会话内容编辑、轮次裁剪与真物理文件清理插件**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![DSH Compatibility](https://img.shields.io/badge/DSH-%3E%3D0.1.0--0%20%3C1.0.0-ff69b4.svg)](https://github.com/ziyuanlingo/dsh-session-manager)

---

## 简介 | Overview

在 DeepSeek Harness（DSH `0.2.x`）的多轮文档翻译工作台与 Agent 研发流程中，默认会话机制仅支持追加事件与逻辑归档（Archive），存在两大长期痛点：
1. **无法真正删除会话与磁盘文件**：归档仅隐藏侧边栏条目，`data/dsh/sessions/` 下的多帧 Zstandard 日志（`session.v4.jsonl.zstd`）、`session_projcache` 投影快照以及上传附件依然长期占用磁盘；
2. **传统分支式编辑产生大量冗余副本**：旧版第三方消息编辑插件不仅因依赖已移除的前端内部 Store 包在 DSH `0.2.1+` 崩溃或报版本不兼容，且每次微调一句话都会克隆出一个全新的会话 ID，导致侧边栏迅速堆积大量历史分支垃圾。

**`dsh-session-manager`** 专为解决上述问题而设计：提供 **100% 原地无损修改会话内容（In-Place Lossless Rewrite）** 与 **六步彻底物理级清理（True Physical Deletion）**，零外部运行时依赖（直接利用 Node.js 22+ 原生 Zstandard 能力与 DSH 官方 `Session.prepare` 契约校验），并通过稳定公开的 `slots` 接口同时挂载在 **左侧边栏面板** 与 **每个对话顶部的标签页** 中。

---

## 核心功能 | Key Features

### 1. 🗑️ 真正彻底的物理级删除（单删 / 多选批量删 / 一键清空 0 轮空会话）
执行删除时，插件按严格顺序完成全链路清理：
1. **安全停止并释放文件锁**：若目标会话正处于运行或内存挂载态，自动取消当前轮次并调用 `agent.scope.dispose()` 走宿主标准 `teardown()` 释放 `SessionWriteLease` 句柄；
2. **工作区实时解绑（侧边栏即时消失）**：从 `workspaceRegistry` 所属工作区调用 `detachSession`、移除置顶（Pin）与归档（Archive）记录，自动触发 `domain/changed` 使前端左侧会话列表实时同步移除；
3. **物理清除会话日志目录**：彻底删除 `data/dsh/sessions/<workspace-slug>/<sessionId>/` 文件夹及其内部的 `session.v4.jsonl.zstd` 多帧压缩日志（若父目录已空亦自动回收）；
4. **清除投影与查询缓存**：删除 `data/dsh/storages/session_projcache/sessions/<sessionId>.json` 文件及内存投影表、`coldLogMemo` 与 `sessionQuery` 观察缓存；
5. **孤儿上传附件智能回收**：自动扫描被删会话事件中引用的 SHA-256 附件 ID，核对其余存活会话是否仍引用该附件；若已无任何引用，物理删除 `data/dsh/attachments/v1/` 下对应的 `file-objects` 与 `files`；
6. **预设插件状态同步清理**：若环境安装了 `dsh-preset-enhance`，自动清理其 `state.json` 中残留的 `bindings[sessionId]` 与 `sessions[sessionId]` 编译缓存。

### 2. ✏️ 真正原地无损修改会话内容（零副本垃圾）
所有编辑均直接作用于**原会话 ID**，保持工作区位置、工具调用上下文与预设绑定不变：
- **原地修改任意消息块**：直接展开编辑任意回合的 **👤 用户输入（`user/message`）**、**💭 思考链（`assistant.reasoning`）** 或 **🎀 助手正文回复（`assistant.text`）**；
- **原地删除指定回合 / 向后截断**：支持单轮移除（如剔除因网络/配额报错的废轮次）或从指定回合起向后截断；自动成对剥离前置 `agent/inbox/spliced` 收件箱投递事件，并将保留事件重排为连续的 `seq = 0..N-1` 与 `turn = 1..K`，同步修正 `messageSeqs` / `sourceEventSeqs` 引用；
- **原地修改会话标题**：直接改写或追加 `session/title` 事件并同步 `sessionTitle` 服务；
- **手动追加完整回合**：支持在会话末尾原地补写一轮自定义 `User + Reasoning (可选) + Assistant` 闭合回合。

### 3. 🛡️ 双重安全与耐久性保障
- **落盘前官方契约重放预校验**：任何原地修改在接触磁盘前，均先传入宿主 `ctx.sessions.prepare()` 执行完整的 `v4` 事件流重放与状态机不变量验证；若结构不合法将直接拦截报错，绝不损坏现有日志文件；
- **多帧 Zstandard 原子替换**：优先调用宿主 `sessionPersistence.encodeMaterialization()`（内置双帧带校验和 Zstd 编码器兜底），先写入同目录临时文件完成 `fsync()`，再通过原子 `rename()` 覆盖目标 `session.v4.jsonl.zstd`。

---

## 安装指南 | Installation

### 方式一：通过 DSH CLI 从 GitHub 直接安装

```bash
dsh plugin --profile web add github:ziyuanlingo/dsh-session-manager
```

### 方式二：克隆到本地目录并通过 `link:` 挂载（推荐本地开发与定制工作台）

1. 将本仓库克隆至本地插件目录（例如 `plugins/dsh-session-manager`）：
   ```bash
   git clone https://github.com/ziyuanlingo/dsh-session-manager.git plugins/dsh-session-manager
   ```

2. 在 Web Profile 的 `package.json`（如 `data/dsh/profiles/web/package.json`）中添加依赖并建立软链接（或执行 `dsh plugin --profile web add -w link:./plugins/dsh-session-manager`）：
   ```json
   {
     "dependencies": {
       "dsh-session-manager": "link:./plugins/dsh-session-manager"
     }
   }
   ```

3. 在 `cordis.patch.yml`（如 `data/dsh/profiles/web/cordis.patch.yml`）的 `- insert:` 列表中启用插件：
   ```yaml
   - insert:
       - id: session-manager
         name: 'dsh-session-manager'
   ```

4. 重启 DSH Web 服务并刷新浏览器页面即可生效。

---

## 使用说明 | Usage

插件加载后，在 DSH Web 界面提供**两个入口**：

1. **全局会话管理面板（左侧边栏）**：
   - 点击左侧工具栏的 **「会话全权管家」** 图标，打开双栏管理视图；
   - 支持按关键词搜索（标题 / 会话 ID / 工作目录）、按工作区筛选、专门筛选 **「0 轮空会话」** 或未归属在 `workspace.json` 中的 **「孤儿会话文件」**；
   - 勾选会话可点击 **「🗑️ 彻底删除选中」** 批量物理清理，或直接点击 **「🧹 清空会话」** 一键清理全部 0 轮空会话。

2. **单会话快速编辑（对话窗口顶部标签栏）**：
   - 在任意对话界面顶部点击 **「会话编辑/删除」** 标签页（位于「对话 / 轨迹」右侧），自动加载当前会话的全部回合；
   - 点击任意消息块右上角的 **「✏️ 原地编辑」** 修改文本并点击 **「💾 原地保存修改」**；
   - 点击回合标题栏右侧的 **「✂️ 删除本轮」** 或 **「⏭️ 从第 N 轮起向后截断」** 即可裁剪历史；
   - 修改完成后，点击右上角 **「✨ 同步刷新主界面」** 即可在主对话视图中立即查看更新后的内容。

---

## HTTP 接口参考 | API Reference

所有接口均挂载于宿主同源 `webServer` 的 `/session-manager` 前缀下，自动继承 DSH Web 认证会话保护：

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/session-manager` | 渲染会话管理与编辑 Web 工作台页面 |
| `GET` | `/session-manager/api/sessions` | 聚合全部工作区会话、内存状态、磁盘路径与字节占用统计 |
| `GET` | `/session-manager/api/session?sessionId=<id>` | 读取单个会话的完整头部、结构化回合、可编辑消息块与附件列表 |
| `POST` | `/session-manager/api/rename` | 原地更新指定会话标题（`{ sessionId, title }`） |
| `POST` | `/session-manager/api/edit-message` | 原地修改指定消息块或思考块文本（`{ sessionId, eventSeq, blockIndex, text }`） |
| `POST` | `/session-manager/api/delete-turns` | 原地移除指定回合数组并自动重排序号（`{ sessionId, turns: number[] }`） |
| `POST` | `/session-manager/api/append-turn` | 在会话末尾原地追加一轮完整对话（`{ sessionId, userText, reasoningText?, assistantText }`） |
| `POST` | `/session-manager/api/delete-sessions` | 彻底物理删除一个或多个会话及全部关联文件（`{ sessionIds: string[] }`） |

---

## 开发与测试 | Development & Testing

运行语法检查与内置单元测试（要求 Node.js `>= 22.0.0`）：

```bash
npm run check
npm test
```

---

## 开源许可 | License

本项目采用 [MIT License](./LICENSE) 开源许可协议。
