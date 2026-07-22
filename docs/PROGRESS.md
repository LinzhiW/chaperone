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

[ai_verified] S3 Worker edits a real file on a branch  ✓ LIVE end-to-end
  [ai_verified] worker creates/checks out git branch
  [ai_verified] worker write_file — HITL-gated (nothing written until CEO approves) + auto-commit
  [ai_verified] /api/diff — CEO sees the real committed diff (base auto-detect main/master)
[ai_verified] S4 Checkpoint + Reviewer + merge  ✓ LIVE end-to-end
  [ai_verified] reviewer reads real diff, returns annotations (caught a planted bug)
  [ai_verified] /api/merge — accept → --no-ff merge to base; clean conflict abort
  [ai_verified] ReviewerPanel: per-branch View diff + Accept & merge wired

Golden path S1→S4 mechanism complete + AI-verified. Awaiting CEO click-test acceptance.

[ai_verified] S5 L2 layered parallel + overlap gate   (post-MVP iteration; LIVE-verified)
[ai_verified] S7 Multi-provider selection (runtime)   (post-MVP iteration; LIVE-verified)
[pending]     S6 L3 worktree parallel · S8 skill loadout UX · S9 recruit · S10 PWA · S11 billing
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

### 2026-07-06 — by Claude Code (autonomous run: S3 + S4 plumbing)
- Slices: S3 (worker writes on a branch) + S4 (checkpoint + reviewer + merge)
- Key finding: the worker-execution machinery already EXISTS and is wired —
  `/api/execute-mission` (git branch + write_file + HITL approval) + frontend
  `startWorker`/`approveAction`. So S3/S4 = verify + fill gaps, not build from zero.
- Built (all model-independent, so verifiable now):
  - `getBaseBranch()` — auto-detect main vs master (endpoints hardcoded `main`, broke on
    `master` repos). Fixed `branch-status` + `reviewer` to use it.
  - `GET /api/diff` — real git diff of a branch vs base (S3: CEO sees what the worker wrote).
  - `POST /api/merge` — merge branch into base with `--no-ff`; aborts cleanly on conflict (S4).
  - Frontend: `viewDiff` + branch-diff overlay (colorized), `acceptAndMerge`, per-branch
    "View diff" / "✓ Accept & merge" in ReviewerPanel, `mergedBranches` tracking.
- Verified in a throwaway git sandbox (NO model needed):
  - worker path creates + checks out `feat/add-line` ✓
  - `/api/diff` detects `master` base, returns the real unified diff ✓
  - `/api/merge` produced a real `--no-ff` merge commit; `master` gained the change ✓
  - frontend `vite build` clean (37 modules, exit 0) ✓
- PENDING (blocked, not a code gap): the model-driven steps — worker actually generating
  the write, reviewer generating annotations. Both OpenAI + Gemini API calls were timing
  out from the Node backend at build time (curl reached the hosts; same backend succeeded
  earlier in the day → transient network/provider issue). Will retry on a loop.
- Status: S2 ai_verified; S3/S4 plumbing ai_verified (sandbox), model-half pending.
- Files changed: server/src/index.ts, src/App.tsx, docs/ACCEPTANCE.md, .canopy/progress.json

### 2026-07-06 (later) — by Claude Code (autonomous run: S3+S4 LIVE verified + proxy fix)
- ROOT CAUSE of the model-API outage: this machine reaches OpenAI/Google/Anthropic ONLY
  through a local proxy (127.0.0.1:7892, WinINET ProxyEnable=1). curl respects HTTPS_PROXY;
  **Node's fetch/undici does NOT by default**, so the backend went direct → blocked → timeout.
- FIX (permanent): `server/dev.cjs` launcher sets `NODE_USE_ENV_PROXY=1` before Node starts,
  so undici honors HTTPS_PROXY. `npm run dev` now uses it (old script kept as `dev:direct`).
  Harmless when no proxy is set. Also bumped OpenAI adapter to timeout 120s + maxRetries 4
  (proxy connections are slow/flaky).
- execute-mission now AUTO-COMMITS the worker's changes to its branch after a successful run,
  so the write becomes a real diff the CEO can review (/api/diff) and merge (/api/merge).
- LIVE end-to-end verification (sandbox git repo, gpt-4o through the proxy):
  - S3: worker created feat/add-line → read hello.txt → wrote "line three" (each HITL-approved)
    → auto-committed "worker(FE-Worker): …". master stayed clean. /api/diff showed the real
    committed diff (+line three). ✓
  - S4: /api/merge merged feat/add-line into master (--no-ff, "…accepted by CEO"); master
    gained the line. Reviewer read a branch with a planted bug and returned the correct
    annotation (type:bug, calc.py:2, "subtraction instead of addition"). ✓
- Status: S2 ai_verified; S3 + S4 ai_verified (LIVE). Golden path S1→S4 mechanism complete.
  Only the CEO click-test acceptance remains (Human Acceptance Gate — mine to build, yours to accept).
- Files: server/src/index.ts, server/src/providers/openai.ts, server/dev.cjs, server/package.json,
  docs/PROGRESS.md, docs/ACCEPTANCE.md, .canopy/progress.json

### 2026-07-06 (iterations) — by Claude Code (autonomous run: S5 + S7)
- S5 L2 layered parallel plan + overlap gate:
  - `POST /api/pm/l2-plan` — agentic: PM reads real files, splits ONE slice by LAYER
    (UI/API/persistence), assigns per-worker allowedFiles/forbiddenFiles + interface
    contracts. DETERMINISTIC overlap gate flags any two workers sharing a file (the
    conflict check that makes L2 safe).
  - Frontend: `planL2()` + "Plan L2 parallel work" preset (renders layered plan + contracts
    + conflict verdict inline).
  - LIVE-verified on agent-company (slice "add a project switcher"): PM produced a clean
    3-worker UI/API/Persistence split with real file ownership + 2 contracts, no conflicts.
    Overlap gate unit-tested: correctly caught a shared src/App.tsx between two workers.
- S7 Multi-provider selection:
  - `getProvider()` now honors a runtime override; `GET/POST /api/provider` +
    `availableProviders()`. Settings modal gained an engine selector (greys engines with
    no key). LIVE-verified: switch gpt-4o↔gemini-2.5-flash; claude (no key) rejected;
    back to auto → gpt-4o. Per-*worker* routing left as future.
- Frontend `vite build` clean (exit 0).
- Status: S5 + S7 ai_verified. Post-MVP roadmap: 2 of the 7 iteration slices built.
- Files: server/src/index.ts, server/src/providers/index.ts, src/App.tsx, docs/MVP.md,
  docs/PROGRESS.md, .canopy/progress.json

## Backend Readiness (post-MVP iterations) — as of 2026-07-06
```
S6 L3 worktree     🟡 primitive built + verified: POST/GET /api/worktree, /api/worktree/remove
                      (create→list→on-disk→remove). AUTO-DISPATCH into worktrees still needs
                      CEO explicit confirm (L2→L3 gate) — not built.
S8 Skill loadout   🟢 backend READY + verified: /api/skills (47), saved-sets CRUD, and
                      execute-mission already injects skill content by name. Only equip UX left.
S9 Recruit         🟢 backend READY + verified: /api/team CRUD, 6 role-presets, RecruitModal
                      exists. Only recruit→dispatch wiring (UI) left.
S10 PWA            ⚪ no backend (manifest + service worker are frontend build config).
S11 Billing        🔴 CEO decision (pricing + payment provider). Not started.
```

### 2026-07-06 (backend prep) — by Claude Code
- Built S6 worktree primitive (`/api/worktree` create/list/remove) — the L3 mechanism.
  Verified end-to-end in the sandbox (create new-branch worktree → list → dir on disk →
  remove → gone). Auto-parallel-dispatch left for CEO confirm.
- Verified existing S8/S9 backends are ready (skills 47, saved-sets, team CRUD, 6 role
  presets, skill injection in execute-mission). Documented that only their UIs remain.
- Files: server/src/index.ts, docs/MVP.md, docs/PROGRESS.md, .canopy/progress.json
