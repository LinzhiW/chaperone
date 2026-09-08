# Session Handoff — read this first in a new window

**Snapshot taken:** 2026-06-09 (end of day — P1 backend + accurate build tracker)
**Branch:** `refactor/model-provider` (P1 committed here; branched off `feat/t1-structured-tasks`)

---

## TL;DR — resume here tomorrow

**Read first:** [BUILD_TRACKER.md](BUILD_TRACKER.md) — the accurate, code-verified
status board (visual vs wired columns). Then [PRD.md](PRD.md) (spec) + [TODO.md](TODO.md).

**What landed today:**
1. **P1 — provider-agnostic backend.** New `server/src/providers/` (`types.ts`
   `ModelProvider`/`ChatSession`, `gemini.ts` adapter, `index.ts` `getProvider()`
   factory). `index.ts` rewired so all 4 model calls (`/execute-mission`,
   `/ceo/chat`, `/nudge`, `/reviewer`) go through the interface — no Gemini-specific
   code left in `index.ts`. `tsc --noEmit` clean + module loads under ts-node.
   ⬜ **Still pending: a live end-to-end run with a real `GEMINI_API_KEY`.**
2. **Accurate BUILD_TRACKER** — re-audited against real code (the old gap table was
   based on pre-pivot files).

## 🔴 Most important finding (tomorrow's first task)
**The PM → plan → dispatch chain is visually built but functionally orphaned.**
`sendPmMessage` (real `/ceo/chat` + TASK_PLAN parse → `pendingAssignments`) is
**never called**. The PM composer routes into a hardcoded demo (briefing chips →
fake W1/W2/W3 plan). So `dispatchMission` gets empty `pendingAssignments` →
**no UI path to create a real mission**, even though worker exec / HITL / reviewer
are all wired and functional.

**→ Tomorrow, first build task: reconnect this link.** Wire the PM idle composer to
`sendPmMessage`, render real `pendingAssignments` as the plan (replace the hardcoded
W1/W2/W3 block), so the app runs end-to-end: brief → plan → dispatch → workers →
reviewer. Then move to the Skills cluster (library -> import -> loadout -> saved sets), the core differentiator.

## Branch / git state
- On `refactor/model-provider`: P1 + tracker + this handoff committed.
- `feat/t1-structured-tasks` has the M0+M1 + v2-docs archive (commits `4a3f233`, `07fbf34`).
- **Uncommitted, intentionally local (do NOT commit):** `docs/product-intro.md`,
  `docs/weekly-report.md`, `docs/weekly/` — content assets for LinkedIn / website log.

## Environment
- Backend: `cd server && npm run dev` → http://localhost:3005 (needs `GEMINI_API_KEY` in `.env`)
- Frontend: `npm run dev` → http://localhost:5173
- View Skills/etc.: app gates on onboarding (`config.projectPath` in localStorage);
  `?screen=…` forces onboarding phases for preview.

## Open decisions still parked
- Which skills = the always-on **system base set** (curate at build time).
- `/ceo/chat` Google-Search grounding stays Gemini-specific until P3.
