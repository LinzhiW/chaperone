# Agent Company · 设计逻辑汇总

**版本：** 截至 2026-05-19 的对话沉淀
**对应 wireframe：** `Agent Company Wireframes.html`
**主要执行者：** Linzhi + Claude

---

## 📦 交付记录（Delivery log for Claude Code）

每次把这份 doc 交给 Claude Code，都在这里加一条。**所有 `═══ DELIVERY ═══` 分割线以上是已经交付过的内容，Claude Code 不应该 rebuild；分割线以下是这次交付的新增量。**

| # | 日期 | 覆盖范围 | 内容摘要 |
|---|---|---|---|
| 1 | **2026-05-18** | §1 – §10 | 词汇表 · 4 条架构铁律 · PM 角色定义 · 用户旅程 · sidebar IA · PM panel 结构 · Mission Dashboard · Reviewer 基础设计 · 视觉系统 · P1 八屏（0/0a/0b/0c/1/2/3/4） |
| 2 | **2026-05-19** | §10.5 – §10.7 + §15 + 21 屏画布 | **Phase 2 (5-10)**：Reviewer full + 4 类批注 / PM Docs HITL / Archive flow ·　**Phase 2b (11-17)**：Skills 系统 / Recruit / HITL reject / Worker chat / Brief 流程 ·　**第三批精修**：13a 拆 19+20 / 全局滚动条 / Skills library 重构 / 画布按用户旅程重排 ·　**新增 §15**：与 Claude Code 当前实现的对齐 |

每次交付后，把对应的分割线下移到这一批最末。

---

## 1. 词汇 (Glossary)

| 词 | 含义 | 备注 |
|---|---|---|
| **Project / Workspace** | 一个本地代码目录（git 仓库） | 一个项目一份独立的 PM 记忆 |
| **PM** | Project Orchestrator agent | 一个项目**只有一个 PM**，常驻 |
| **Team** | 这个项目的"组织架构"，包含 PM + 各 Department | 跟"人才池"同义 |
| **Department** | 一类 worker 的归属（Frontend / Backend / …） | 一个 dept 下挂多个 specialist worker |
| **Worker** | 具体执行型 agent（ui-worker / api-worker / qa-worker / …） | 每个 worker 一段独立 chat、一条 branch |
| **Mission** | 一次完整的工作任务 | 原 "Session"，跨多个 worker / branch |
| **Assignment** | Mission 内分给单个 worker 的子任务 | 原 "Task" |
| **Dispatch** | 用户点 ▶ 把 plan 下发给 worker 开干 | 一次单向、需用户主动触发 |
| **HITL** | Human-in-the-loop — 每个 tool call 等用户批准 | Claude Code 风格 inline |
| **Skill** | 可装备到 worker 的能力 .md 文件 | 例：TDD-Expert / a11y-audit |

---

## 2. 架构铁律

1. **人不批准，平台不动** — 没有任何自动跳转 / 自动 dispatch / 自动 PR
2. **PM 不写代码 / 不批 tool call / 不进 running mission** — 只规划 + 追进度 + 维护 doc
3. **协调通过 git branch，不通过运行时** — worker 间不直接通信
4. **保护用户工作** — 任何写文件/合并/推送前先 commit 或备份

---

## 3. PM 的角色定义

### PM 做什么
- 读你的 codebase，建立项目记忆
- 持续维护几份 markdown 文件 = PM 的记忆载体：
  - `PRD.md` — 产品需求 / 目标 / 现状
  - `SOP.md` — 约定的开发实践（命名 / 测试 / 分支策略）
  - `Dev log.md` — 历次 Reviewer 报告归档 + 重要决策
  - 未来可能更多（ARCHITECTURE.md / DECISIONS.md / …）
- 根据用户 brief 出 mission plan
- 接收 reviewer 报告并更新 doc

### PM 不做什么
- 不写业务代码
- 不批 tool call（只有用户和 worker 之间有 HITL 关系）
- 不进入 running mission（mission 启动后 PM 退场）
- 不自动 dispatch

### 为什么这样切
- **PM 上下文稳定** — 不被 worker 细节污染
- **Worker 专注度高** — 每个 worker 只关心一条 branch
- **用户始终是 boss** — 在每个关节点都是用户决定下一步

### PM 上下文断裂怎么办
- 三层防御：
  1. **后端做项目级长期记忆**（结构化数据，不靠聊天历史长度）
  2. **每个 chat 历史按 session 隔离**，长了后端压缩
  3. **UI 上显式展示 PM "记得什么"**（顶部 "memory: 12 missions · 4 decisions"）
- PM 的"记忆"= markdown 文件 + 后端 metadata，**和聊天历史解耦**

---

## 4. 用户旅程 (User flow)

```
┌──────────────┐
│ 0a Welcome   │  没项目，选 / 克隆 / 试示例
└──────┬───────┘
       ↓
┌──────────────────┐
│ 0b PM 自我介绍 +  │  PM 读 codebase、起 PRD/SOP
│    scan workspace │  每步 HITL，用户批准
└──────┬───────────┘
       ↓
┌──────────────────────┐
│ 0c Project ready ·    │  Team 只有 PM，dept 待召集
│    no missions yet    │  PM 提示"what shall we build first?"
└──────┬───────────────┘
       ↓ (用户 brief 一个目标)
┌──────────────────┐
│ 1 PM Chat        │  PM 跟用户对话，决定要不要起 mission
└──────┬───────────┘
       ↓ (PM 起草 plan)
┌──────────────────────┐
│ 2 PM · Mission Plan   │  doc-style plan + 右侧 sticky 评论
│  (drafting)           │  橙色 "Dispatch?" 确认区
└──────┬───────────────┘
       ↓ (用户点 ▶ Dispatch — PM 退场)
┌──────────────────────┐
│ 3 Mission Dashboard   │  2×2 worker grid，每个独立 chat
│  (running, no PM)     │  每 tool call HITL 批准
└──────┬───────────────┘
       ↓ (用户决定调 reviewer)
┌──────────────────────────┐
│ 4 Reviewer report         │  cross-branch diff + 4 类批注
│  (user decides)           │  用户 → 决定 "iterate" 或 "Archive to PM dev log"
└──────┬───────────────────┘
       ↓
   报告写入 dev log → PM 顶部出红点 "1 new report" → 用户回 PM panel 看汇报
```

---

## 5. 左栏信息架构（共用 Sidebar）

从上到下，**稳→动**：

```
WORKSPACE         · ~/todo-app · main         ← 当前打开的目录（folder card + chevron）
▾ TEAM            +                            ← 加 dept
   ● PM           💬                            ← 永远第一个，唯一
   ▸ Frontend Dept
      — ui-worker
   ▸ Backend Dept
      — api-worker
   (onboarding 阶段 dept 显示 "no departments yet — PM will suggest")
▾ MISSIONS        +                            ← 起新 mission
   ● Dark mode mission  [2]                    ← 红色 hitl 计数 badge
   ◐ JSON parser refactor
   ＋ new mission
▾ SKILLS          +
   ✓ TDD-Expert
   ✓ a11y-audit
```

### 设计规则
- 每个 section header 都有折叠 ▾ 箭头
- 可以加新成员的 section 在右侧有绿色 ＋（Team / Missions / Skills，dept subhead 没有）
- HITL 计数用纯数字 badge（红圆），不要文字
- PM 右侧的 💬 图标提示"可以聊"
- Mission 项按状态用不同符号：● running / ◐ paused / ○ done / + new

---

## 6. PM Panel 内部结构

PM Panel 是一个**带 tabs 的复合页面**：

```
┌─ identity bar:  [PM avatar] Project Orchestrator · plans · tracks · never executes      memory: 12 missions · 4 decisions
├─ tab strip:     [Chat] [PRD.md] [SOP.md] [Dev log.md · 1 new]
├─ running missions banner: ⚡ 2 missions are running while you talk to me · [chip][chip]
└─ tab body (页自己控制 scroll + composer 钉底)
```

### Chat tab 两种状态
- **普通对话**（Phase 1 · #1）：欢迎 + 介绍卡 + 历史对话 + 底部 sticky composer + 快捷 chips
- **drafting Mission Plan**（Phase 1 · #2）：横向分屏 — 左边 doc（带可见滚动条）+ 右边 sticky 评论 gutter（带"批量 Send all to PM"）+ 底部 sticky composer

### 评论的两种工作流
- **直接对话**：底部输入框打字
- **批量评论**：选中文档部分 → 加 sticky → 攒几条 → 点 "Send all to PM" 一次性让 PM 统一改

---

## 7. Mission Dashboard 设计

进入 Mission 后**完全没有 PM**：

- 顶部 Mission strip：`● Running · 4 workers · 2 HITL pending`（含 ← PM panel 跳转按钮）
- 2×2 Worker grid，每张 tile：
  - 顶部：worker id + role + branch + 状态（running / wait / idle）
  - 中部：tool call stream + HITL approval 卡（每个待批的 tool call inline）
  - 底部：**独立 chat composer**（用户可单独 nudge 这个 worker）
- 底部 Reviewer 召唤条：`[Call Reviewer]`（用户主动触发）

---

## 8. Reviewer 设计

用户主导，**不是 PM 在审**：

- 顶部 4 个 branch ribbon（每个 worker 一条 + 改动统计）
- 左半：reviewer notes（4 个类别：⚠ warn / ℹ info / ✓ good / 自动归类）
- 右半：diff preview（点 notes 切换文件）
- 底部 decision bar：
  - `← Send back to workers`（继续 iterate）
  - **`✓ Archive to PM's dev log`**（接受，自动写入 dev log + PM 出红点）
  - `Create PRs on GitHub`（最终输出）

### 关键：PM 是下游被动接收
- Reviewer 报告不会自动发给 PM
- 用户先看 → 决定 iterate or archive → 选 archive 才进 PM 记忆
- PM 不当 gate，PM 只追进度

---

## 9. 视觉系统（当前半保真）

| 元素 | 选择 |
|---|---|
| 字体 | Inter (UI) · JetBrains Mono (mono) · Caveat (手写体备注) |
| 背景 | `--paper: #faf7f0` 暖白 |
| 主色 | `--pm: #3b6aa8` 蓝（PM）· `--review: #c97a3a` 橙（review/dispatch）· `--approve: #4a7c4a` 绿（已批准 / 成功） |
| Worker 色 | 4 个固定颜色对应 4 个 worker，跨屏一致 |
| Card | `--rule` 1.5px 实线为主，placeholder 用 dashed |
| HITL 卡 | 浅黄底 + 橙边 + claude-code style 单色命令字符 |
| sticky 评论 | `#fff3b8` 黄底 + 手写体 |

---

## 10. 屏的总目录（当前画布）

| # | Section | Artboard | 状态 |
|---|---|---|---|
| 0 | Current state | CEO Chat dashboard (today) | baseline 不动 |
| 0a | Onboarding | Welcome (no project) | ✓ done |
| 0b | Onboarding | PM onboarding scan | ✓ done |
| 0c | Onboarding | Project ready · no missions | ✓ done |
| 1 | Proposed P1 | PM panel · Chat | ✓ done |
| 2 | Proposed P1 | PM panel · drafting Mission Plan | ✓ done |
| 3 | Proposed P1 | Mission · running dashboard | ✓ done |
| 4 | Proposed P1 | Mission · Reviewer report | ✓ done |

---

═══════════════════════════════════════════════════════════════════════════
**═══ DELIVERY 1 · 2026-05-18 · everything above this line was in the first handoff ═══**
═══════════════════════════════════════════════════════════════════════════

> Claude Code: 上方内容你之前已经看过。不要 rebuild 任何在那以上已经定下来的东西，除非下面的新内容**明确推翻**了某条旧决定（应该不会，但如果你发现冲突，停下问 Linzhi）。

---


## 10.5 Phase 2 · 第一批（已完成 — 2026-05-19）

按 dev 那边对优先级的反馈重排（Reviewer 精细化 > PM Doc 交互模式 > Archive 流程），先开 6 屏：

| # | Section | Artboard | 备注 |
|---|---|---|---|
| 5 | Reviewer (full) | Reviewer Panel · full | 加 4-type annotation 系统：🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing |
| 6 | PM Doc tabs | PM · Dev log.md | 模式 A（读 + edit raw）+ 入口列表 |
| 7 | PM Doc tabs | PM · PRD.md | 模式 B（结构化 section + HITL 内联 diff） |
| 8 | PM Doc tabs | PM · SOP.md | 模式 B，无 pending edits 的稳定状态 |
| 9 | Archive flow | Mission · done (pre-archive) | 4 worker 全绿 + 顶部 archive 主 CTA |
| 10 | Archive flow | Archive flow · post-archive | toast + PM 主动开口 + sidebar grayed mission + PM 红点 |

### 关键决策
- **Reviewer 4 类批注**：颜色统一进 `ANN` 常量（wf-phase2.jsx 顶部），每类有 icon/label/color/soft/text
- **PM Doc 交互模式**：Dev log = 模式 A（plain markdown），PRD/SOP = 模式 B（结构化）。模式 C（git-diff style）延后
- **PRD 的 HITL**：PM 提议的内容用绿色 inline diff 显示，可以**按 section 批准**或**底部一键 approve all**
- **Archive 之后 PM 主动开口**：是整个产品里**唯一**"PM 自己说话"的时刻；其他时候 PM 都等用户找
- **Sidebar 增加"Archived"子分组**：归档后的 mission 移到这里，灰色 + 删除线

### 设计原则保留
- P1 4 屏完全没动，备份在 `backups/phase1/`
- Phase 2 全部在新文件 `wf-phase2.jsx` 里，不污染 P1 模块
- 4 类 annotation 的颜色都从已有 token 派生，没引入新 token

---

## 10.6 Phase 2 · 第二批（已完成 — 2026-05-19）

骨架补齐：Skills 系统 + Recruit + HITL 拒绝 + Worker 深入 + Brief 流程。新增 7 屏（11-17）。

| # | Section | Artboard | 备注 |
|---|---|---|---|
| 11 | Skills system | Skills · library | 分类左栏 + 卡片网格 + 搜索 + 来源筛选（built-in / yours / GitHub） |
| 12 | Skills system | Skill · import / new | 模态 · 3 种 source（.md upload / GitHub URL / paste） · 可即时装备 |
| 13 | Skills system | Skill loadout · W1 | **Option C 横排槽位** · 6 slots · 拖拽库 + saved sets 一键 apply |
| 14 | Recruit + HITL | Recruit · new worker | 3 步向导（Role → Skills → Identity）· 6 个预设角色 |
| 15 | Recruit + HITL | HITL · reject + rewrite | 拒绝后 2 种回应：A 改写 cmd · B 仅给 feedback |
| 16 | Chats | Worker chat · W1 | Dashboard tile 点击展开 · 完整 tool call stream + 右栏 worker 状态 |
| 17 | Chats | PM · briefing a new mission | PM clarifies → option chips → 锁 scope → 点 "Draft plan" 进屏 2 |

### 关键决策
- **Skill loadout 选 C（横排槽位）** — 用户选的，理由"机制和组合表达清楚最重要，A/B 太游戏化"
- **6 个角色预设全是工程**（Frontend / Backend / Mobile / QA / DevOps / Data） — Design/Marketing 这种非代码部门**先踢出去**，留 Phase 3
- **Recruit 不需要独立 Dept 屏** — Dept 从 role 预设自动推导
- **HITL 拒绝有 2 个出口** — 改写命令 (A) 或纯 feedback (B)，A 走快速路径，B 走 worker re-plan
- **Worker chat 是 dashboard tile 的"放大版"** — 同一份数据流，多了右栏的 branch / loadout / files 状态
- **Brief 流程靠 clarification chips 减打字** — 不是纯聊天，而是 PM 给选项让用户点

### 设计原则
- Phase 1 + Phase 2 第一批文件**完全未改**，全部新增在新文件里
- Skills 数据 (`SKILL_LIB` / `ROLE_PRESETS` / `SAVED_SETS`) 集中在 `wf-skills-data.jsx`，避免重复定义
- 备份 `backups/phase2a/` 保存了 P2 第一批的快照

---

## 10.7 Phase 2 · 第三批：精修 + 重排（已完成 — 2026-05-19）

—— 上面两批是**加屏**，这批主要是**改屏 + 整理**。

### 改屏（按 teammate comment 处理）

**画面整理 · 减"框框焦虑"**

- **屏 17 · Skills · library**
  - 砍掉中间 categories 中间栏，并入 left sidebar 的 SKILLS 段（categories + frequently used + saved sets 三组）
  - 顶部 search 拉大，支持 `frontend` / `source:you` 等 query
  - 加排序段控（Most used / Newest / By role）
  - "＋ Add new skill" 不再占 grid 格子，改成顶部主按钮 + sidebar SKILLS 头部 ＋
  - 右侧加"Saved sets · Compose"功能面板（取代之前的手写批注栏 — 所有 P2b 屏的批注栏统一在此屏移除）
  - Sidebar 底部 stub："🌐 Skill community · soon" —— 留 Phase 3 出口

- **屏 19 · Skill loadout（之前的 13a）**
  - **拆成 19 + 20**：worker-bound loadout vs. compose new set（两种心智分开）
  - **去掉 6 槽位上限** —— equipped 用 wrap chip 列表，多少都行
  - chip 不再显示 category（library 卡里有，避免重复）
  - Save / Save as new set / Discard 全部 inline 到 Equipped 框头部（底部独立 save bar 删了）
  - Equipped 框圆角 10 + 米色背景，跟下方 library 卡（圆角 4 + 白底）形状区分（缓解视觉压力）
  - 砍掉"PREVIEW / Replace / Merge"独立 strip（用户看不懂） —— apply set 直接改 Equipped 状态，所有"未确认"统一汇到顶部 Equipped 框

**HITL**
- 屏 9 · HITL · reject + rewrite —— 拒绝后 2 条路径（A 改写 cmd · B 仅 feedback）
- 全局：每个 worker tile size 一致（CSS `height:100%`）+ tile body 内部独立滚动条；4 个并列永不变形

**滚动条工具类 `.wf-scroll`**
- 所有 `overflow:auto` 区域统一加这个 class，可见细滚动条
- 覆盖所有屏的 13+ 个滚动区
- 共享 styles 在 wf-styles.css

**PM Chat 新增 chip**
- 蓝色突出的"✎ Scope screens for design · new vs. derived" —— Linzhi 要的入口

### 重排画布顺序（按用户旅程）

之前按"phase 加进来的时间"排，新旧屏穿插。改成**按用户旅程**：

| Section | 屏号 | 屏 |
|---|---|---|
| 0 · Baseline | 0 | 现状 CEO Chat dashboard |
| 1 · Onboarding | 1-3 | Welcome / PM scan / Project ready |
| 2 · Start a mission | 4-6 | PM Chat / Brief / drafting Plan |
| 3 · Mission running | 7-9 | Dashboard / Worker chat / HITL reject |
| 4 · Mission ending | 10-12 | All done / Reviewer full / Archived |
| 5 · PM memory | 13-15 | PRD.md / SOP.md / Dev log.md |
| 6 · Team & Skills | 16-20 | Recruit / Library / Import / Loadout / Compose |

**总屏数 22 → 21**（砍掉 P1 那个简陋的 Reviewer stub，P2 full 完全 supersede；备份在 `backups/phase1/`）

### 文件状态
- 现有 5 个 P2/P2b JSX 文件全保留，没合并（合并风险大，意义小）
- `backups/phase2b/` 备份了重排前的快照
- `.design-canvas.state.json` 删了（之前的用户拖拽顺序已无效）

---

═══════════════════════════════════════════════════════════════════════════
**═══ DELIVERY 2 · 2026-05-19 · end of latest handoff ═══**
═══════════════════════════════════════════════════════════════════════════

> Claude Code: everything between Delivery 1 and Delivery 2 dividers is **new since your last build**. This is §10.5 / §10.6 / §10.7 / §15 plus the canvas reorganization.
>
> **⚠ Conflict resolution policy: 设计稿这边比代码 step forward 一点**。如果设计稿里的某个决定跟你已经写过的代码冲突，**以设计稿为准**，把代码改过来对齐设计（不是反过来）。理由：UI/UX 决定是产品决定，比实现细节优先。如果你觉得某个改动代价过大，停下来跟 Linzhi 商量，**不要**自己保留旧实现。
>
> **What's new — buildable features:**
> - Reviewer Panel · full version with 4-type annotations (🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing) — supersedes the P1 stub you built earlier
> - PM Doc tabs (PRD/SOP/Dev log) with HITL-on-PM-edits diff pattern — **note**: these markdown files live in the **user's project** under `~/<project>/.agent-company/`, NOT in your agent-company repo's own `docs/` folder
> - Mission archive flow (Done → Reviewer → Archived) + sidebar archived sub-section
> - Skills system (much bigger than the placeholder you have): library / import (.md / GitHub / paste) / worker loadout (no slot cap) / compose reusable sets — supersedes the simple "select skill files" pattern in your DEV_PLAN T4
> - Recruit worker: 3-step modal, 6 engineering role presets
> - HITL reject + rewrite: two paths (A rewrite cmd, B feedback-only) — extends your binary approve/deny
> - Worker chat deep-dive (zoom from dashboard tile)
> - Brief-a-mission flow (PM clarifies via option chips before drafting plan)
> - **§15** — full reconciliation between this design and what's currently in your repo. Read this first.
>
> **What's NOT new but worth re-checking against your build:**
> - Canvas was reorganized into 7 user-journey sections (Onboarding → Start → Running → Ending → PM memory → Team & Skills). Screen numbering shifted — match by screen name, not by old index.
> - Global: every worker tile is now equal-size with its own scrollbar (CSS `.worker-tile` rule). If you'd hardcoded fixed heights, swap to the new pattern.

---

## 15 · 对齐与 Claude Code 当前实现（2026-05-19 git inspection）

读完 `LinzhiW/agent-company@main` 的代码状态后，列出**设计稿 vs 当前实现**的差异。冲突时**以设计稿为准**（见上方 policy）。

### 15.1 技术栈现状（不需要改）

| | 现状 | 设计稿假设 | 处理 |
|---|---|---|---|
| 前端 | React 18 + Vite + TypeScript + Tailwind | ⚠ 没指定 | ✅ 采纳，wireframes 的 inline style 改 Tailwind 类即可 |
| 图标 | lucide-react | ⚠ 没指定 | ✅ 采纳，wireframes 里的 emoji/字符图标全部换成 lucide |
| 后端 | Node.js Express + SSE，端口 3005 | ⚠ 没指定 | ✅ 采纳 |
| HITL 通道 | SSE `require_approval` 事件 + `/api/approve-action` POST | 设计稿只说"HITL inline" | ✅ 沿用现有协议 |
| 工具集 | `run_shell` / `read_file` / `write_file` | ✅ 一致 | ✅ |
| LLM | Gemini 1.5 Pro（via Google AI Studio） | 设计稿没写死 | ✅ 暂时沿用，未来考虑加 Claude/多 provider |
| 状态持久化 | localStorage（`useLocalStorage` hook） | 设计稿假设有持久化 | ✅ 沿用 |

### 15.2 视觉方向（**这里 design 推翻了 dev**）

**当前实现 = Discord 暗色** (`#202225` / `#2b2d31` / `#5865f2`)，三栏固定网格。
**设计稿 = 暖纸色半保真**（`#faf7f0` 米白 + 蓝 / 橙 / 绿 + 手写体批注）。

**结论：以设计稿为准，但是是"基于设计稿的信息层级和组件语义"，不是照抄半保真颜色。**

- ✅ 沿用**信息架构和布局**：设计稿的 sidebar 分组（Workspace · Team · Missions · Skills）、PM panel 的 tab 结构、Mission dashboard 2×2 grid、HITL inline card — 这些是产品决定
- ⚠ **重新做主题**：以下都要新做，不能照抄 Discord 暗色，也不能照抄暖纸色：
  - 是否暗色 / 亮色 / 两者都有 — Linzhi 拍板
  - 主色 / 强调色 / 状态色（PM / Worker / Review / Approve / Warn）—— 设计稿用了 4 个 token，结构保留，具体色值重新调
  - 字体 — 设计稿的 Inter + JetBrains Mono 是工业标准，可以沿用；Caveat 手写体已经从产品 UI 里清理掉了
- ❌ **要砍掉的**：当前 App.tsx 里 inline style 硬编码的所有 Discord 颜色（`#5865f2` 这种 hex 值）—— 全部换成 Tailwind 主题 token

### 15.3 词汇表对齐

| 当前实现里的词 | 设计稿里的词 | 处理 |
|---|---|---|
| Session | Mission | **统一改成 Mission**（设计稿铁律 §12） |
| Task | Assignment | **统一改成 Assignment**（保留 internal API 名也行，UI 文案统一） |
| CEO / CEO Chat | PM / PM Panel | **改成 PM**（语义更准 — Project Manager / Orchestrator）|
| Worker Panel | Worker / Worker tile | 等价，沿用 Worker Panel 也行 |
| Department | Department | ✅ 一致 |
| Skill | Skill | ✅ 一致 |
| Skill Loadout | Loadout | ✅ 一致 |

PRD `docs/PRD.md` 里"Sessions / CEO Chat"这些过时词汇，下次 Claude Code 改代码时一并对齐过来。

### 15.4 概念边界 ⚠ 容易混淆

**两套 PRD/SOP/Dev log.md 文件**，不要混淆：

| | agent-company 的 docs/ | 用户项目里的 .agent-company/ |
|---|---|---|
| 用途 | **agent-company 这个产品自己**的 PRD / CHANGELOG / DEV_PLAN | **PM 管理用户项目**用的 PRD / SOP / Dev log |
| 谁写 | 你（Claude Code）和 Linzhi | PM agent 在 runtime 写，每次写都要用户 HITL |
| 位置 | `LinzhiW/agent-company/docs/` | `~/<user-project>/.agent-company/` |
| 屏 | 不出现在产品 UI 里 | 屏 13 (PRD) / 14 (SOP) / 15 (Dev log) |

设计稿里所有提到 PRD.md / SOP.md / Dev log.md，**指的都是后者**。

### 15.5 Skills 系统的 gap

**当前实现**：localStorage 里塞两个种子 skill，UI 是简单列表 + prompt 添加。Dev plan T4 假设 47 个 skill 文件已经在 `.agents/skills/` 目录里。

**设计稿**：完整 skill 库（屏 17）+ 3 种导入（屏 18）+ worker loadout（屏 19）+ 可复用 saved set（屏 20）。

**对齐做法**：
1. Skill 文件位置 — 设计稿建议 `~/.agent-company/skills/`（用户全局）+ 项目级 override `<project>/.agent-company/skills/`。需要 Linzhi 拍板。
2. localStorage 只放 UI state（哪个 skill 当前装备给哪个 worker），不放 skill 内容本身（内容是 .md 文件）。
3. 屏 17 的 search 支持 `source:you` / `source:github` / `source:built-in` 这种 query — 来源是文件 metadata，不是数据库字段。
4. Saved sets（屏 20）是另一种 .json 文件，存在 `<project>/.agent-company/sets/`。

### 15.6 Reviewer 的 gap

**当前 dev plan T7**：很轻量 — 创建一个"Reviewer Panel"，初始上下文是 git diff，输出报告。

**设计稿屏 11**：远比这复杂：
- 4 个 branch 的 ribbon（每个 worker 一条 + commit/file stats）
- 4 类批注系统（🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing）自动归类
- 左右分屏：左 annotations 列表 + 右 cross-branch diff（点 annotation 跳文件）
- 底部决策栏：Send back / Archive / Create PR 三选一 + state machine

**对齐做法**：扩 T7 的范围。Reviewer 本质还是一个 agent，给它的 system prompt 里塞 4 类批注的 schema，让它结构化输出。前端按 schema 渲染屏 11。

### 15.7 Mission 状态机的 gap

**当前实现**：`PROPOSED → EXECUTING`，没有终态。

**设计稿**：`idle → briefing → planning → running → reviewing → archived`（六态）。

**对齐做法**：补全状态机。每个 state 对应一个屏或一组屏（briefing = 屏 5，planning = 屏 6，running = 屏 7/8/9，reviewing = 屏 10/11，archived = 屏 12）。

### 15.8 PM "主动开口"的实现

设计稿铁律：PM 只在**用户 archive 一次 reviewer 报告之后**主动开口一次，其他时候 PM 都等用户找（屏 12）。

当前实现：CEO Chat 进来就有欢迎语，但没有"归档触发 PM 新消息"的机制。

**对齐做法**：归档时后端给 PM session 推一条 system message + 在 PM panel 顶部出红点；用户回 PM panel 时显示 PM 的新建议。

### 15.9 不要做的事（你那边已经埋了坑的）

- ❌ **DEV_PLAN.md 里 T8 "GitHub PR 触发"用 `gh pr create`** —— 沿用没问题，但屏 11 决策栏里的 "Create PRs on GitHub" 按钮要走 HITL，不能一键创建（用户得在弹出的命令上点过 Approve）
- ❌ **`startMission` 里直接打开 SSE 不等用户确认** —— 当前 `startMission(taskId)` 函数应该在用户点过 ▶ Dispatch 之后才被调用，确保 user-initiated（设计稿铁律 §2.1）
- ❌ **TASK regex 解析 LLM 回复**（`/\[TASK:\s*([^,]+),\s*([^\]]+)\]/g`）—— 短期可以，长期换成 function calling / JSON Schema 输出，更稳

---


| 屏 | 目的 | 优先级 |
|---|---|---|
| Worker chat（单 worker 深入） | 用户深入跟某 worker 谈，看完整对话 | 延后 |
| 创建新 mission 的对话流 | "我要做 X" → PM 出 plan 的完整序列 | 延后 |
| Recruit a new worker / Dept | 当 mission 需要新 role 时的招聘 UI | TODO |
| 多 mission 并行 | 当 ≥2 个 mission 在跑时的切换体验 | TODO |
| HITL 拒绝 / 改写 flow | 用户对 tool call 说"不"会发生什么 | TODO |
| PM Doc · 模式 C（git-diff） | PM 自动生成 + diff 高亮，最重 | 延后 |

---

## 12. 命名 / 文案规范

- 用户视角的动词：**Brief**（开始 mission） · **Dispatch**（下发） · **Iterate**（迭代） · **Archive**（归档到 PM）
- 不要混用 Session / Mission / Task，统一用：
  - Mission = 一整次工作
  - Assignment = mission 内的子任务（给单个 worker 的）
  - Task = 不再使用
- "Talk to PM" / "PM panel" — 用户找 PM 永远是回到那个固定入口
- 数字 badge 不带单位（不写 "2 hitl"，只写 "2"）

---

## 13. 已撤回 / 否决的方案

- ❌ 在 mission running 视图里嵌"Talk to PM"按钮 → 与"session 内无 PM"冲突
- ❌ "Ask PM to revise" 单独按钮 → 已被底部 composer + Send all to PM 取代
- ❌ "Open questions" + "Risks" 两个 H3 → 简化为一个橙色 Dispatch 确认框
- ❌ QA Dept → 去掉，让 PM 按需推荐
- ❌ Dept subhead 上的 + 按钮 → 不符合"recruit worker"的语义
- ❌ "bug hunt" 快捷 chip → 太发散，不是合适的 mission 类型

---

## 14. 文件结构

```
Agent Company Wireframes.html       入口
├─ wf-styles.css                    色板 / 排版 token / 组件样式
├─ wf-shared.jsx                    Sidebar / TopBar / MissionRail / WorkerTile / HitlCard
├─ wf-current.jsx                   baseline（现状复刻）
├─ wf-onboarding.jsx                0a / 0b / 0c
├─ wf-pm.jsx                        PMShell + PM_Chat + PM_MissionPlan
├─ wf-mission.jsx                   MissionStrip + Mission_Dashboard + Mission_Reviewer
├─ wf-phase2.jsx                    P2 屏 5-10 + 4-type annotation 系统 (ANN)
├─ wf-skills-data.jsx               P2b · SKILL_LIB / ROLE_PRESETS / SAVED_SETS + SkillCard primitive
├─ wf-skills.jsx                    P2b · 屏 11-13 · 库 + import + loadout
├─ wf-recruit-hitl.jsx              P2b · 屏 14-15 · 招聘 + HITL 拒绝
└─ wf-worker-brief.jsx              P2b · 屏 16-17 · 单 worker 深入 + brief 对话

backups/phase1/                     P1 完整快照（2026-05-19，动 P2 之前）
backups/phase2a/                    P2 第一批快照（2026-05-19，动 P2b 之前）

Dashboard Hi-Fi.html                独立高保真复刻（不在画布里）
uploads/DEV_PLAN.md                 原始开发计划（基础参考）
```

---

*这份 doc 会随着对话继续更新。每次有架构性决定时我会补一段。*
