# Design Notes — Architecture Decisions

## PM 的核心定位

PM 的工作是帮助用户搭建**工作流**，而不只是执行任务。  
具体体现：PM 通过 PRD.md / SOP.md / Dev log.md 把用户的意图固化成项目记忆，  
让每次 mission 都能在这个记忆的基础上运行，而不是每次从头 re-derive。

---

## 工作流审批触发点（Workflow Approval Trigger）

**触发条件：** 用户在 screen 1.3 点击 "Approve & write" 或 "Approve all 3"

**触发后应发生的事：**

1. **PM 面板 tabs 出现** — PRD.md / SOP.md / Dev log.md 三个 tab 从 PM panel 顶部显示出来  
   （之前是 hideDocs=true，只有 Chat tab）

2. **Sidebar 文件区域更新** — 对应的 .md 文件出现在 Workspace / Files 区域  
   （`main · just opened` → `main · clean`，files 列表里出现 PRD.md / SOP.md / Dev log.md）

3. **PM 发一条确认消息** — "Done. PRD.md / SOP.md / Dev log.md are now in your project root. I'll keep them updated as we work."

**状态变量：** `docsReady: boolean` — false = hideDocs, true = 显示全部 tabs + 文件

---

## 真实 API 集成时的底层逻辑（预埋）

当接入真实 Gemini/Claude API 后，screen 1.3 的审批流需要对应：

```
用户 Approve PRD.md
  → 调用 POST /api/pm-doc-apply { file: 'PRD.md', content: <generated content> }
  → backend 把文件写进 <projectPath>/.agent-company/PRD.md
  → frontend 收到成功响应 → docsStep++ (or docsReady=true)

用户 Skip
  → 不写文件，直接推进 step
```

PM 在 1.2 (scan) 阶段读文件时，实际应调用：
```
GET /api/files?path=<projectPath>   → 获取文件树
POST /api/ceo/chat { message: "analyze this project" }  → PM 分析
```

PM 在 1.3 (docs) 阶段生成文档时，实际应调用：
```
POST /api/pm-generate-doc { type: 'PRD' | 'SOP' | 'devlog', files: [...] }
  → 返回 generated markdown content 用于 HITL 展示
```

**原则：** PM 的每个 write_file 都必须经过 HitlCard 审批，不允许静默写入。

---

## Sidebar 文件显示规则

| 状态 | Sidebar Files 区域 | PM tabs |
|------|--------------------|---------|
| 刚打开文件夹 (1.2) | `📁 ~/project ⌄` + `main · just opened` | Chat only |
| 审批部分 doc (1.3) | 同上（文件还没落盘） | Chat only |
| 全部审批完 (1.4) | files 列表里出现 PRD.md / SOP.md / Dev log.md | Chat + PRD.md + SOP.md + Dev log.md |
| Skip all | 无 .md 文件 | Chat only（直到 M5 手动创建） |
