# 📌 BUILD TRACKER — pinned (accurate project status)

> Re-audited against the **actual code** (App.tsx + server) on 2026-06-09 — not the
> old wireframe-based estimate. Two separate columns because "built" was ambiguous:
> **视觉** = screen renders · **功能** = wired end-to-end to real data/backend.
> Spec: [PRD.md](PRD.md) · backlog: [TODO.md](TODO.md).

**Legend:** ✓ done · ⚠️ partial / demo-data · ✗ missing

## ✅ Headline finding — FIXED 2026-06-10
The PM → plan → dispatch chain was visually built but **functionally orphaned**
(`sendPmMessage` never called; composer routed to a hardcoded demo). **Reconnected:**
the idle composer + chips now call the real `/ceo/chat`, `pendingAssignments` render
as the live plan, and Dispatch creates a real mission. **The app is now end-to-end:
brief → PM plan → dispatch → workers → reviewer.** (Pending: live run with API key.)
The old hardcoded `pmScreen='briefing'/'plan'` blocks are now dead code → cleanup later.

## Status table

| 模块 | 设计屏 | 视觉 | 功能 | 说明 |
|------|--------|:--:|:--:|------|
| Onboarding · Welcome→Ready | 0a/0c | ✓ | ✓ | `enterProject`→`/init-project` wired |
| Onboarding · PM scan + docs HITL | 0b | ✓ | ✗ | scan/doc steps are hardcoded copy (M1 visual-only) |
| PM 对话 (idle chat) | PM_Chat | ✓ | ✓ | **reconnected** — composer/chips call real `/ceo/chat` |
| PM 简报澄清 | 17 | ⚠️ | ✗ | designed clarify chips are dead code; real flow goes brief→plan direct (clarify needs backend support) |
| PM 任务规划 + dispatch | PM_MissionPlan | ✓ | ✓ | **reconnected** — renders real `pendingAssignments`; Dispatch creates a real mission |
| PM 文档页 · PRD | 7 | ✓ | ⚠️ | edits hardcoded (from archive demo) |
| PM 文档页 · SOP | 8 | ✓ | ✗ | static |
| PM 文档页 · DevLog | 6 | ✓ | ⚠️ | lists real archived missions; entries demo |
| Mission 看板 | Mission_Dashboard | ✓ | ✓ | real `assignments` + `startWorker` SSE (now reachable via the reconnected PM flow) |
| Worker 深入 | 16 | ✓ | ✓ | `nudgeWorker`→`/nudge` |
| HITL approve/reject | 15 | ✓ | ✓ | `approveAction`→`/approve-action` |
| HITL 改写命令 | 15 | ✗ | ✗ | reject-with-rewrite not built |
| Reviewer | 5 | ✓ | ✓ | `callReviewer` SSE + `/create-pr` |
| Mission 收尾 done/archived | 9/10 | ✓ | ⚠️ | archive sets done + toast; queued PRD edits are demo |
| 招募 Worker | 14 | ✗ | ✗ | not built |
| Skills · 库 | 11 | ✗ | ✗ | backend `/skills` lists names only |
| Skills · 导入 | 12 | ⚠️ | ⚠️ | add-skill modal = paste-only (works); .md/GitHub tabs ✗ |
| Skills · 配装 (loadout) | 13a | ✗ | ✗ | not built |
| Skills · 组套 (compose) | 13b | ✗ | ✗ | not built |

## Backend (server/src) — endpoints exist & provider-agnostic after P1
`/ceo/chat` · `/execute-mission` (SSE) · `/approve-action` · `/nudge` · `/reviewer`
· `/create-pr` · `/branch-status` · `/init-project` · `/add-skill` · `/skills` · `/config`
— all present. P1 routed every model call through `ModelProvider` (🟦 code-complete, pending live run).
**No backend gap blocks the headline fix — it's purely frontend re-wiring.**

## Priority
1. ✅ **Reconnect PM→plan→dispatch** — DONE (2026-06-10). App is end-to-end (pending live run).
2. ⬜ **Skills cluster** (库→导入→配装→组套) — core differentiator; needs a shared Team/loadout data model first, then per-screen agents.
3. ⬜ Recruit · HITL-rewrite · done/archived polish · clarify-step backend.
