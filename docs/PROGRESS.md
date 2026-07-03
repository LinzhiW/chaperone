# Canopy — Progress Map

> "Where are we / who changed what" source of truth. The right-side progress view is
> rebuilt from this file. Update on every slice status change, verification, blocker,
> or hand-off. Newest log entry on top.

## Current Map

```
MVP Goal: CEO briefs a goal → PM plans → Workers build on branches → CEO reviews & merges
Overall: 2 / 4 required vertical slices accepted
Gear: L1 (read-only)   ·   Foundation volatility: High

[accepted] S1   PM produces a real plan  ✓ CEO-accepted 2026-06-23 ("图一 good start point")
  [done]    backend  /api/pm/plan (POST generate + GET load)  — server/src/index.ts
  [done]    backend  pm-plan.json persistence                 — server/src/persistence.ts
  [done]    frontend PmPlanPanel (goal input + plan render)   — src/App.tsx
  [done]    polish: panel moved below PM intro; PmPlanPanel removed from always-on position
  [done]    polish: /api/project-review → segmented markdown (removed paragraph cap)

[accepted] S1.5 PM actions agentic + presets + Progress Board  ✓ CEO-accepted 2026-06-23
  [done]    /api/pm/explore — truly agentic: model drives with list_files/read_file tools,
            chooses what to read, replies in its own voice. No hand-fed file blobs.
  [done]    PM intro + presets visible in idle even with prior chat history
  [done]    language mirrors CEO's last typed message (English in → English out; 中文 → 中文)
  [done]    ProgressBoard — global collapsible bottom bar reads .canopy/progress.json;
            collapsed: project/gear/counts/badges; expanded: full slice tree with subtasks.
            CEO: "可以这个位置不错" (position good; label "vertical slices" noted for later)
  [done]    presets rewired: Check progress + Plan agent dispatch now agentic (see S2 log)

[ai_verified] S2 PM dispatches read-only L1 audits  (backend built; CEO click-test pending)
  [done]    /api/pm/audit — 3-phase: PM decides auditor count → parallel read-only fan-out
            → PM consolidates. PM chooses N auditors (not hardcoded).
  [done]    consolidation upgraded: embeds PM_MODEL_PREAMBLE + gold-standard structure
            (stage → golden path+deps → slice class → foundation+volatility → gear+reason
            → concrete allocation → recommendation+question). Verified on phrasewise.
  [done]    "Plan agent dispatch" chip (renamed from "Make a parallelization plan")
[pending] S3   Worker edits a real file on a branch
[pending] S4   Checkpoint + Reviewer + merge
```

## Workflow-routing fixes (this session)
```
A  /api/ceo/chat: PLAN mode gated to explicit code-change requests only; read/understand/
   audit/progress → MESSAGE (PM's own work, no worker dispatch). Verified via curl.
B  "Check project progress" → agentic /api/pm/progress-report: PM reads real PROGRESS.md/
   MVP.md/status docs, reports in own voice + follow-up. (Was: dead render of seeded JSON.)
C  dispatchMission no longer switches views — stays in PM chat, drops a trace message.
D  Running missions render as inline clickable cards in the chat; click → detail view.
   + dismiss (✕) to cancel stuck/unwanted missions.
FIX seed pollution: getProgress no longer fabricates Canopy's own slices into every
   project (was polluting phrasewise with S1-S4). Returns EMPTY map when none exists.
```

## Foundation Files (manifest — volatility measured against this list)

```
src/App.tsx                    front-end app shell, all views, state
server/src/index.ts            all backend endpoints / PM endpoints
server/src/persistence.ts      .canopy/ JSON persistence
server/src/providers/*         model adapters (Claude/OpenAI/Gemini)
```

Volatility: **High** — S1 just changed three of these. → stay at L1 / single active slice.

## Ports / run
Frontend (Vite) `http://localhost:5183` · Backend (Express) `http://localhost:3005`.

## Timestamped Log

### 2026-06-23 — by Claude Code
- Slice: S1 PM produces a real plan
- Built: `/api/pm/plan` (reads real file tree + README/pkg/MVP/PROGRESS, embeds the PM
  operating model, returns structured JSON), `pm-plan.json` persistence, `PmPlanPanel`
  in the PM tab.
- Files changed: server/src/index.ts, server/src/persistence.ts, src/App.tsx
- Verification: AI pre-check passed in running app (5183) — plan card renders the real
  project (enumerated real provider files not listed in any doc), Gear L1 + reason,
  serial golden path, persisted to .canopy/pm-plan.json and reloaded on refresh. No
  console errors.
- Result: ai_verified → awaiting_human_acceptance

### 2026-06-23 (later) — by Claude Code
- Slice: S1 → accepted; two acceptance-time fixes
- CEO accepted S1 (the plan card: real files + L1 + persistence). "图一 good start point."
- Fix 1 (ordering): PmPlanPanel was rendered ABOVE the PM self-intro. Moved it to
  render after the welcome block. Verified in UI: intro → presets → plan panel.
- Fix 2 (formatting): `/api/project-review` prompt forced "3–5 sentences" → one block.
  Removed the cap; now returns segmented Markdown (bold mini-headings), rendered by
  renderRich. Verified in UI: "What it is / Tech stack / Current state / …" segments.
- Principle applied: only shape output the UI must render (plan JSON); stop fighting the
  model's natural prose (the paragraph cap was the wrong kind of shaping).
- Files changed: src/App.tsx, server/src/index.ts
- Result: accepted. Deferred S1.5 (peer presets + inline render) per CEO.
- Next step: CEO decides S1.5 vs S2.

### 2026-06-23 (S1.5 complete) — by Claude Code
- Slice: S1.5 PM actions agentic + presets + Progress Board
- Built:
  - `/api/pm/explore`: agentic loop (up to 16 steps), model drives with list_files/read_file;
    no pre-fetched files passed in; language mirrors CEO's last message.
  - PM intro + presets: changed gate from `pmMessages.length===1` → `pmScreen==='idle'`
    so presets always visible when returning to PM tab.
  - Language detection: frontend detects CJK in last user-typed message → sends `lang:'zh'`;
    backend maps to explicit language name to prevent model guessing wrong language.
  - `ProgressBoard` component: collapsible bottom bar above BottomBar; reads
    `/api/pm/progress` (→ `.canopy/progress.json`); 7-state internal lifecycle folded to
    5 CEO-facing labels (done/working/needs you/waiting/blocked).
  - `GET /api/pm/progress` + `PUT /api/pm/progress` endpoints + `getProgress()`/`saveProgress()`
    in persistence.ts. Seeds `SEED_PROGRESS` on first read (S1/S1.5 accepted, S2-S4 pending).
- Files changed: server/src/index.ts, server/src/persistence.ts, src/App.tsx
- CEO feedback: "可以这个位置不错，虽然信息不准（s1-4应该是vertical slices），但可以先这样"
  → label tweak noted (will say "vertical slices" not "steps"), position accepted.
- Result: accepted → moving to S2.
