# Agent Company · 设计逻辑汇总

**版本：** 截至 2026-05-19 的对话沉淀
**对应 wireframe：** `Agent Company Wireframes.html`
**主要执行者：** Linzhi + Claude

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

## 11. Phase 2 待办（已记下，没开始）

| 屏 | 目的 |
|---|---|
| PM panel · PRD.md tab | 让用户看 / 编 PRD（PM 写也要 HITL） |
| PM panel · SOP.md tab | 同上 |
| PM panel · Dev log.md tab | 看历史 reviewer 报告流 |
| Worker chat（单 worker 进入） | 用户深入跟某 worker 谈，看完整对话 |
| 创建新 mission 的对话流 | "我要做 X" → PM 出 plan 的完整序列 |
| Recruit a new worker | 当 mission 需要新 role 时的招聘 UI |
| 多 mission 并行 | 当 ≥2 个 mission 在跑时的切换体验 |

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
└─ wf-mission.jsx                   MissionStrip + Mission_Dashboard + Mission_Reviewer

Dashboard Hi-Fi.html                独立高保真复刻（不在画布里）
uploads/DEV_PLAN.md                 原始开发计划（基础参考）
```

---

*这份 doc 会随着对话继续更新。每次有架构性决定时我会补一段。*
