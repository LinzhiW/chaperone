# Project State — Agent Company

**Last updated:** 2026-05-19
**Branch:** `feat/t1-structured-tasks` (T1 + T2 complete, T3 next)

---

## Architecture

```
Frontend  React 18 + Vite        port 5174
Backend   Node.js Express         port 3005
LLM       Gemini 2.5 Flash        via GEMINI_API_KEY in .env
```

## Core flow (what works today)

```
PM Panel → user briefs goal
  → PM outputs <<<TASK_PLAN>>> JSON
  → Assignment cards appear with Dispatch button
  → User clicks Dispatch → Mission created → Mission Dashboard opens
     → each WorkerTile: "Brief & start" → SSE stream → HITL approve/reject → tool executes
  → [T3+] per-worker independent backend session
  → [T7+] Call Reviewer → cross-branch report → Archive to PM dev log
```

## Task checklist

| Task | Status | Notes |
|------|--------|-------|
| T1 · PM structured JSON output | ✅ done | `<<<TASK_PLAN>>>` block, Assignment type |
| T2 · Multi-panel UI + data model | ✅ done | Mission + Assignment, sidebar, PM Panel, Mission Dashboard |
| T3 · Per-panel backend session | ✅ done | `panelSessions` Map, `activePanels` Set, `/api/panel/:id/nudge` |
| T4 · Skill loadout injection | ✅ done | `readSkillContent()`, `systemInstruction` build, `/api/skills`, PM prompt updated | Skills injected into worker system prompt |
| T5 · Git branch auto-checkout | ⏳ | `git checkout -b feat/xxx` on worker start |
| T6 · Dashboard branch status | ⏳ | Commit count / file diff per branch |
| T7 · Reviewer panel | ⏳ | Cross-branch diff + 4-type notes + decision bar |
| T8 · GitHub PR trigger | ⏳ | `gh pr create` button |

## Key design decisions

- **PM role**: plans + maintains docs (PRD.md, SOP.md, Dev log.md), never executes, never enters running mission
- **Mission = one goal**, Assignment = one worker's subtask on one branch
- **HITL**: every tool call pauses for user approval — no autonomous execution
- **Git isolation**: one Assignment = one branch, coordination via git not runtime
- **Visual theme**: dark (current) stays for demo; warm white (`#faf7f0`, wf-styles.css tokens) will be light/bright mode — implement after T5 when core flow is stable

## Terminology (from DESIGN_LOG)

| Term | Meaning |
|------|---------|
| PM | Project Orchestrator — one per project, always present |
| Team | PM + all Departments |
| Department | Frontend / Backend / etc — groups worker types |
| Worker | Executing agent — one chat session, one branch |
| Mission | One complete work goal (was "Session") |
| Assignment | Worker's subtask within a mission (was "Task") |
| Dispatch | User triggers workers to start — one-way, manual |
| HITL | Every tool call needs user approval |
| Skill | Loadout .md file injected into worker system prompt |

## File structure

```
server/src/index.ts       Express backend, SSE, HITL loop, Gemini integration
src/App.tsx               All frontend (Rail + Sidebar + PM Panel + Mission Dashboard)
src/hooks/useLocalStorage.ts
docs/DEV_PLAN.md          8-task breakdown with estimates
docs/CHANGELOG.md         History of changes
docs/PROJECT_STATE.md     This file
```

## Ports / env

```
GEMINI_API_KEY=...        required
GEMINI_MODEL=gemini-2.5-flash   default
Frontend: http://localhost:5174
Backend:  http://localhost:3005
```
