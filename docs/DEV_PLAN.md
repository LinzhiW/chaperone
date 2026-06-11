> ⚠️ **SUPERSEDED (2026-06-09).** This is the original T1–T8 single-stack (Gemini)
> plan — all 8 tasks are done. The project has since pivoted to a provider-agnostic
> architecture. **For the current plan see [TODO.md](TODO.md); for the spec see
> [PRD.md](PRD.md) v2.1; for status see [PROJECT_STATE.md](PROJECT_STATE.md).**
> Kept for history only. The "铁律" below still hold and informed the new HITL model.

# Canopy — Development Plan

**版本：** v0.1 草稿
**日期：** 2026-05-18
**目标：** Google Hackathon 可演示 MVP
**作者：** Linzhi Wang + Claude

---

## 0. 铁律（绝不违反）

1. **人不批准，平台不动。** 没有任何自发触发——所有阶段切换、agent 调用、merge 操作都必须用户显式点击触发
2. **平台是编辑器，不是 runtime。** Worker panel 是独立的会话单元，平台不充当 agent 的运行环境
3. **协调通过 git，不通过运行时。** Worker 之间不通信，所有交付都通过 git branch
4. **保护用户工作。** 任何写文件/合并/推送操作前必须 commit 或备份

---

## 1. 架构 C：多 Panel HITL（最终选定）

```
┌─────────────────────────────────────────────────────────────┐
│  PM Panel（已有的 CEO Chat）                                 │
│  - 用户描述目标                                              │
│  - PM 输出结构化任务计划 + skill loadout 分配               │
│  - 用户审核 → 点 "Start Mission"                            │
└─────────────────────────────────────────────────────────────┘
                          ↓ 用户批准后
┌────────────┬────────────┬────────────┐
│ Worker P1  │ Worker P2  │ Worker P3  │ ← 各自独立的 chat panel
│ Loadout A  │ Loadout B  │ Loadout C  │   每个 = 独立 LLM session
│ Branch:    │ Branch:    │ Branch:    │   每个 tool call HITL approve
│ feat/A     │ feat/B     │ feat/C     │
└────────────┴────────────┴────────────┘
                          ↓ 各自 push 完，用户点 "Call Reviewer"
┌─────────────────────────────────────────────────────────────┐
│  Reviewer Panel                                              │
│  - 拉所有 branch 的 diff                                     │
│  - 生成 review 报告（提交给 PM 或直接给用户）               │
└─────────────────────────────────────────────────────────────┘
                          ↓ 用户决定
                  [改进] or [Create PR → GitHub]
```

**Panel 本质：** 前端的逻辑会话对象，不是 OS 进程。每个 Panel 直接调 LLM API，通过 backend 路由调本地 tool（run_shell / read_file / write_file）。

---

## 2. 当前进度（已完成 ✅）

来自现有代码（~530 行 TS）：

- ✅ Backend Express + SSE 流式输出
- ✅ Gemini 1.5 Pro 集成 + function calling
- ✅ HITL 审批闭环（每个 tool call 暂停等 approve）
- ✅ Tool 集：run_shell / read_file / write_file
- ✅ CEO Chat（能读工作区文件 + Google Search Grounding）
- ✅ API key 本地 .env 管理
- ✅ 三栏 Discord 风格 UI 框架
- ✅ localStorage 持久化

**已经具备的能力 ≈ "单 Worker HITL"完整闭环**。Hackathon 要做的是把这个闭环复制成"多 Worker + Reviewer"。

---

## 3. MVP 任务分解

### 任务 T1：PM 输出结构化任务计划
- **做什么：** 改 CEO system prompt，要求输出 JSON Schema：`[{agent_id, task, branch_name, skill_loadout}]`
- **写 parser** 在 frontend 把 JSON 渲染为可审核的卡片列表
- **代码量：** ~80 行
- **估时：** 2-3h
- **依赖：** 无
- **并行：** ✅ 可独立做

### 任务 T2：多 Panel 数据结构 + UI
- **做什么：** 把现有"单 CEO Panel"重构为"多 Panel"概念
- 每个 Panel 包含：id / role / history / branch / status / skill_loadout
- UI 上以 tab 或 grid 形式展示，可切换查看
- **代码量：** ~150 行
- **估时：** 4-6h
- **依赖：** 无
- **并行：** ✅ 可独立做

### 任务 T3：Per-Panel Session Backend
- **做什么：** 把 backend 的 `/api/execute-mission` 改成支持 `panelId` 参数
- 每个 panel 独立维护对话历史（用 Map<panelId, ChatSession>）
- SSE 端点改为按 panelId 路由消息
- **代码量：** ~100 行（基本是改造已有代码）
- **估时：** 3-4h
- **依赖：** T2 的数据结构
- **并行：** ⚠️ T2 之后

### 任务 T4：Skill Loadout 系统
- **做什么：** 
  - 用户选择 skill files（已存在的 47 个 skills）
  - 创建 panel 时把选中的 skills 注入到 system prompt
  - 支持保存"岗位"模板（Frontend Worker / Backend Worker / Reviewer / 等）
- **代码量：** ~100 行
- **估时：** 3-4h
- **依赖：** T2
- **并行：** ⚠️ T2 之后

### 任务 T5：Git Branch 自动切换
- **做什么：** Panel 启动时自动 `git checkout -b feat/xxx`
- Panel 内 tool 调用全部在该 branch 下执行
- **代码量：** ~50 行
- **估时：** 2h
- **依赖：** T3
- **并行：** ⚠️ T3 之后

### 任务 T6：Dashboard：Branch 状态展示
- **做什么：** 轮询每个 branch 的 commit log / 文件改动数 / 测试状态（如果有）
- 显示在主面板顶部
- **代码量：** ~80 行
- **估时：** 3h
- **依赖：** T5
- **并行：** ✅ 可在 T5 完成后并行

### 任务 T7：Reviewer Panel
- **做什么：** "Call Reviewer" 按钮 → 创建一个特殊 Panel
- 它的初始上下文是各 worker 的 git diff
- 输出 review 报告（也走 HITL，用户审批每个建议）
- **代码量：** ~80 行
- **估时：** 3h
- **依赖：** T6
- **并行：** ⚠️ T6 之后

### 任务 T8：GitHub PR 触发
- **做什么：** Reviewer 完成后，"Create PR" 按钮调 `gh pr create -B main -H feat/xxx`
- 利用本地 `gh` CLI 认证，零额外凭证
- **代码量：** ~30 行
- **估时：** 1-2h
- **依赖：** T7
- **并行：** ⚠️ T7 之后

---

## 4. 总估时 & 并行计划

**串行总时长：** ~25-30 小时
**并行优化（按你的多窗口理念）：**

| 阶段 | 可并行任务 | 估时 |
|------|-----------|------|
| 第 1 波 | T1（PM 输出）+ T2（多 Panel UI）| 4-6h |
| 第 2 波 | T3（Per-panel 后端）+ T4（Skill loadout）| 3-4h |
| 第 3 波 | T5（Git 切换）→ T6（Dashboard）| 5h |
| 第 4 波 | T7（Reviewer）→ T8（PR）| 4-5h |

**实际工期：** 2-3 天能跑通核心 demo。

---

## 5. MVP 不做的事（明确砍掉）

- ❌ 完整 Settings UI（API key 用现有 .env 流程）
- ❌ Session 归档/切换（用 localStorage 就够）
- ❌ Cost Monitor（看 Gemini console 就行）
- ❌ Skills 的可视化管理（直接读 .agents/skills 目录）
- ❌ 自动重连、断线恢复
- ❌ 任何"等条件触发"的自动化

---

## 6. 演示场景（最终交付）

**Pitch：** "给一个简单 React TODO 应用同时加 3 个功能：暗色模式、导出 JSON、键盘快捷键"

**演示流程：**
1. 在 PM panel 输入需求 → PM 输出 3 个任务卡片
2. 用户点 "Start Mission" → 平台创建 3 个 Worker Panel，各自切到独立 branch
3. 演示 1 个 Worker Panel 内的 HITL 流程（approve 几个 tool call）
4. 显示 dashboard 上 3 个 branch 的 commit 数实时变化
5. 用户点 "Call Reviewer" → Reviewer 拉 diff 给报告
6. 用户点 "Create PR" → 跳转到 GitHub PR 页面

**评委记忆点：** "人在每一步都是 boss，agent 永远不会自己开始下一步。"

---

## 7. 开放问题（待定）

- [ ] UI Framework 草图（用户自己画或用 Claude Design）
- [ ] "岗位" 模板的存储位置（localStorage / 本地 JSON？）
- [ ] Reviewer 报告的呈现形式（markdown / 卡片 / 内联 diff？）
- [ ] 多 Panel 切换的 UI 模式（tab / grid / 弹窗？）

---

## 8. 开发原则（呼应 dev-workflow.md）

按用户 8 阶段 SOP 走：
1. ✅ PRD（已有）
2. ✅ 本文档 = Writing Plans 阶段产物
3. ⏳ Executing：按任务清单逐项推进
4. ⏳ Debugging：systematic-debugging skill
5. ⏳ Verification：每个任务做完跑实际场景验证
6. ⏳ Finishing：merge 到 main
7. ⏳ Docs Sync：更新 PRD / PROJECT_STATE / CHANGELOG
8. ⏳ Release：打 tag，准备 demo
