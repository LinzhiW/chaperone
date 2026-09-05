# Design Alignment Plan — Translate Claude Design wireframes 1-to-1

**Started:** 2026-05-19
**Spec source:** `.design/agent-company/project/` (21 wireframes in 7 sections)
**Reference doc:** `.design/agent-company/project/Chaperone Wireframes.html`
**Working rule:** After every milestone, dev server is running and a single screen is shown for user sign-off **before** moving to the next milestone. No silent batch builds.

---

## Why this plan exists

Previous sessions built UI from imagination (CSS tokens only, never read the actual `wf-*.jsx` files in the design bundle). Result: ~80% of screens diverged from the design. This plan re-implements every screen 1-to-1 from the wireframe JSX files, in the order the design canvas presents them.

**Functional code stays.** Backend endpoints (`/api/reviewer`, `/api/create-pr`, `/api/execute-mission` etc.), data model (Mission + Assignment), and state machine all work and won't be rewritten. This is a **visual alignment** pass, not a rewrite.

---

## Milestone 0 · Foundation (token + shared primitives)

**Goal:** Visual primitives shared by every screen are correct before building any screen.

- [ ] Read remaining wireframe files: `wf-pm.jsx`, `wf-mission.jsx`, `wf-worker-brief.jsx`, `wf-recruit-hitl.jsx`, `wf-phase2.jsx`, `wf-current.jsx`, `design-canvas.jsx`
- [ ] Read 3 chat transcripts in `.design/agent-company/chats/` to understand intent
- [ ] Fix `src/index.css` tokens to match `wf-styles.css` exactly:
  - `--rule: #1f1d1a` (solid, not rgba)
  - Add `--worker`, `--worker-soft`, `--review-soft`, `--approve-soft`, `--pm-soft`, `--warn`, `--highlight`, `--comment` (sticky note)
  - Add `--w1` through `--w4` worker swatches
  - Add `--hand` font (Caveat for hand-drawn callouts)
  - Add Inter + JetBrains Mono + Caveat from Google Fonts
- [ ] Build shared component primitives matching `wf-shared.jsx`:
  - `<MissionRail />` — Discord-style multi-mission switcher (one circle per mission, active = square corners + left bar)
  - `<Sidebar />` — proper section structure with green-bordered `＋` buttons, ▾ chevrons, inverted-dark active pill
  - `<TopBar />` — title + pending/branches/cost chips
  - `<BottomBar />` — mono status footer
  - `<HitlCard />` — review-orange bordered approval block
  - `<WorkerTile />` — `box` styling with proper status chip variants
  - `<PMShell />` — identity bar + tab strip wrapper for PM screens
- [ ] Refactor `App.tsx` shell to use these primitives (without re-styling individual screens yet)

**Preview gate:** Dev server running. Show baseline dashboard (current state) with new rail + sidebar + topbar applied. User confirms the chrome looks like the wireframe before moving on.

---

## Milestone 1 · Onboarding (screens 1-3)

**Source:** `wf-onboarding.jsx`

- [ ] **Screen 1 · Welcome (no project)** — full layout with hero copy, 3 entry tiles (Open folder / Clone GitHub / Try example), empty Recent box, `EmptyMissionRail` with dashed AC + dashed green `＋`
- [ ] **Screen 2 · PM onboarding scan** — PM bubble + Step 1 done / Step 2 awaiting HITL (with `HitlCard`) / Step 3 queued, "Skip / Approve all 3" footer
- [ ] **Screen 3 · Project ready** — PM "I'm ready" card with PRD/SOP/Dev log preview chips, composer with quick-start chips

**Hook into existing code:** Replace current "modal-only" onboarding with screen 1. Implement `init-project` flow that walks through scan steps with real HITL.

**Preview gate:** User opens fresh state (no `ac_config.projectPath`), sees Welcome. Walks through scan → ready. Signs off.

---

## Milestone 2 · Starting a mission (screens 4-6)

**Source:** `wf-pm.jsx`

- [ ] **Screen 4 · PM Chat (idle)** — proper PM identity bar + tab strip (Chat / PRD.md / SOP.md / Dev log.md), running missions banner, chat composer with quick-chip shortcuts
- [ ] **Screen 5 · PM briefing a new mission** — PM clarifying questions, user input refining brief, "I'll draft a plan" transition
- [ ] **Screen 6 · PM drafting Mission Plan** — Mission Plan dispatch card with sticky comment annotations, Dispatch confirm bar (warm-orange `--review-soft`)

**Hook into existing code:** Existing PM chat + `<<<TASK_PLAN>>>` parser already works. This is a visual rewrite of the panels + the dispatch card.

**Preview gate:** User briefs a mission, sees plan card with proper styling, clicks Dispatch.

---

## Milestone 3 · Mission running (screens 7-9)

**Source:** `wf-mission.jsx`, `wf-worker-brief.jsx`, `wf-recruit-hitl.jsx`

- [ ] **Screen 7 · Mission Dashboard** — proper Mission strip (status + ←PM button) + 2×2 worker tile grid (using shared `<WorkerTile>`) + Reviewer strip at bottom
- [ ] **Screen 8 · Worker chat deep-dive** — single worker takes full main area, chat history + stream log + HITL inline + nudge composer
- [ ] **Screen 9 · HITL reject + rewrite** — 3-action HITL (Approve / Reject + write feedback / Reject + rewrite proposed command)

**Hook into existing code:** SSE stream + `/api/approve-action` + `/api/panel/:id/nudge` all stay. Visual rewrite + add the deep-dive view + reject+rewrite affordance.

**Preview gate:** User dispatches, sees dashboard, clicks one worker for deep-dive, can approve/reject/rewrite a tool call.

---

## Milestone 4 · Mission ending (screens 10-12)

**Source:** `wf-mission.jsx` (Mission_Done, Mission_Archived), already-built ReviewerPanel needs alignment

- [ ] **Screen 10 · Mission · all workers done** — green status everywhere, "ready to archive" CTA, Call Reviewer button prominent
- [ ] **Screen 11 · Reviewer cross-branch report** — re-align existing `ReviewerPanel` to wireframe (branch ribbon, annotation cards, sticky decision bar)
- [ ] **Screen 12 · After archive** — sidebar mission grays out, PM speaks first with archive summary

**Hook into existing code:** `/api/reviewer` SSE + annotations + `archiveMission` already work. Visual cleanup + add Mission_Done view + archive return flow.

**Preview gate:** Run a small mission end-to-end. Workers done → review → archive → land back in PM with archive message.

---

## Milestone 5 · PM memory tabs (screens 13-15)

**Source:** `wf-pm.jsx` (PM_PRD, PM_SOP, PM_DevLog)

- [ ] **Screen 13 · PRD.md tab** — structured doc view with section anchors, "PM proposed edit" diffs with per-section HITL approval
- [ ] **Screen 14 · SOP.md tab** — structured but stable (low-change doc), HITL on edits, sections for branch naming / commit style / test conventions
- [ ] **Screen 15 · Dev log.md tab** — append-only feed of archive entries, each entry is a past Reviewer report summary

**Hook into existing code:** PM tabs currently just show "...md — PM will generate this after first mission" placeholder. Now make them real: read/write `<project>/.agent-company/PRD.md` etc., show diffs when PM proposes edits.

**Backend additions needed:**
- `GET /api/pm-doc?path=PRD.md` → returns markdown
- `POST /api/pm-doc-propose` → PM-suggested edit (returns diff, awaits user approval)
- `POST /api/pm-doc-apply` → write approved section to disk

**Preview gate:** Open PRD.md tab, see actual file. PM proposes an edit, HITL approves. File on disk updates.

---

## Milestone 6 · Team & Skills (screens 16-20)

**Source:** `wf-skills.jsx`, `wf-recruit-hitl.jsx`

- [ ] **Screen 16 · Recruit Worker** — 3-step modal: pick role preset → assign skills (with Skip option per chat3.md comment #5) → name + identity color
- [ ] **Screen 17 · Skills Library** — full page: Sidebar_Skills (categories + frequently used + saved sets), main grid of LibrarySkillCards, right rail with Saved sets + "Compose a new set" CTA
- [ ] **Screen 18 · Skill Import** — 720px modal: 3 tabs (Upload .md / GitHub link / Paste raw), GitHub URL fetch with status, Name + Category grid, Short description, Content preview, "Equip immediately on" panel, Save to library
- [ ] **Screen 19 · Skill Loadout** — edit one worker's equipped skills: sticky-note equipped panel + Library/Saved-set tabs, drag-to-equip, unsaved indicator, "Save · apply to W1" button
- [ ] **Screen 20 · Compose Skill Set** — 6 named slots, library on left + Set options panel on right (description / save target / role preset seed), save bar

**Hook into existing code:** Skills list already loads from `/api/skills`. Need to extend:
- `POST /api/recruit-worker` (writes worker config to `.agent-company/team.json`)
- Extend `/api/add-skill` to handle GitHub URL fetch + categorization
- `POST /api/skill-set` for saved set compose
- Worker loadout currently embedded in Assignment; extract to per-worker persistent loadout

**Preview gate:** User can recruit a worker, browse library, import a GitHub-linked skill, edit a worker's loadout, compose a set.

---

## Order of operations within each screen

For every screen:
1. Open the corresponding `wf-*.jsx` function (e.g. `Skills_Import` in `wf-skills.jsx`)
2. Translate JSX 1-to-1 — same structure, same children, same inline styles, same className references
3. Where wireframe uses `className="box"` etc. → use the same CSS class (it's already in our `wf-styles.css` clone)
4. Hand-drawn elements (Caveat font callouts, dashed borders) stay decorative — keep them
5. Sticky comment annotations (yellow notes in wireframe) → **don't ship them**, they're design notes
6. Wire to existing backend endpoints / state where the screen has a functional counterpart; mark as static if no backend exists yet

---

## What I'm NOT doing in this pass

- No new backend endpoints unless a screen requires them (call out in the milestone)
- No new features beyond what the wireframe shows
- No "improvements" or "while I'm here" refactors
- No light/dark theme toggle — wireframe is warm-paper, that's the target
- No production polish (animations, micro-interactions) — wireframe doesn't have those

---

## Tracking

After each milestone, update this file with `✓ done · YYYY-MM-DD HH:MM` next to the milestone heading and add a short note about what user feedback resulted in iteration.

| Milestone | Status | Notes |
|-----------|--------|-------|
| M0 Foundation | ✅ done · 2026-05-20 | wf-styles ported (incl. compat shim for M1-M6 phase-out), Google Fonts added, shared primitives (MissionRail/Sidebar/TopBar/BottomBar/PMShell) built, chrome verified at http://localhost:5175 on both PM panel and Mission Dashboard |
| M1 Onboarding | ✅ done · 2026-05-21 | 3 screens ported 1-to-1 from wf-onboarding.jsx, then iterated per user feedback into 4 distinct end-states. Phase machine: welcome → scan → ready → done. EmptyMissionRail, Sidebar_Empty, HitlCard primitives added. Old modal-only onboarding removed. **Welcome tiles re-ordered per user feedback:** Start from scratch (NEW, primary, blue PM-accent border, ✦ icon, `handleStartFromScratch` → window.prompt → `mkdir -p` via existing /api/init-project → skips scan straight to Ready empty) / Open a local folder / Clone from GitHub. "Try with example" tile removed. **Ready screen has two variants:** populated (`scanCompleted=true`, PM "I'm ready" card + PRD/SOP/Dev log chips + 4 quick-start chips) vs empty (`scanCompleted=false`, Caveat hand-written "Blank canvas." prompt + only Plan-a-feature/refactor chips). Skip onboarding from Scan routes to Ready empty (not straight to normal app). Verified at http://localhost:5173 across all 4 paths: Start-from-scratch → Ready empty; Open folder → Scan → Approve all 3 → Ready populated; Open folder → Scan → Skip onboarding → Ready empty; populated/empty Ready → first chip → normal PM panel. Note: dev server defaulted to 5173, not 5175 — port 5175 was last session's pin. |
| M2 PM panel | ⏳ pending | — |
| M3 Mission running | ⏳ pending | — |
| M4 Mission ending | ⏳ pending | — |
| M5 PM memory tabs | ⏳ pending | — |
| M6 Team & Skills | ⏳ pending | — |

---

## Open questions to confirm before starting M0

1. ✅ Resolved: `docs/DEV_PLAN.md` stays as T1-T8 history.
2. ✅ Resolved: Skills show as "Uncategorized" in Library until user opts to add `category:` to frontmatter. UI keeps the category filter, just defaults to "All / Uncategorized".
3. ✅ Resolved: M0 renders MissionRail with one mission. Multi-project later.

---

## chat3.md unprocessed comments — mapped to milestones

Claude Design didn't finish addressing these 11 user comments. They are design decisions I need to either implement or flag during the corresponding milestone.

| # | Comment summary | Maps to | Action |
|---|----------------|---------|--------|
| 1 | Compose set (screen 20) layout should match Loadout (screen 19) | M6 | Implement screen 20 to match 19's section structure |
| 2 | Edit worker loadout (screen 19) entry point unclear — left sidebar selects Skills not the worker | M6 | When entering loadout, sidebar should highlight the worker in Team, not Skills |
| 3 | Missing "user-created category" feature — should live in Skill library category area | M6 | Add "＋ New category" option in Sidebar_Skills categories list (screen 17) |
| 4 | Skill component design inconsistent across pages (screens 17/19/20 sidebars don't match) | M6 | Use ONE shared `Sidebar_Skills` across all 3 screens |
| 5 | Recruit (screen 16) step 2 needs a "Skip / do it later" option — not every worker needs skills | M6 | Add skip button to step 2 |
| 6 | "Only one mission at a time" needs clarification — new mission goes into to-do queue, can chat about queued | M2 | Implement mission queue state ("queued" alongside running/done); PM can chat about queued missions; show queue in running banner |
| 7 | Reviewer (screen 11): sequential per-worker approval vs final batch approval? W1/W3 mixed in right column is confusing | M4 | **Design decision needed before M4** — propose: each annotation has individual "send back to W1" / "send back to W3" buttons, final Archive is the batch approval |
| 8 | HITL reject (screen 9) split is not 4-equal, and W1 has 3 input boxes which is too many | M3 | Reject layout: equal columns when 4 workers; reject panel has ONE input (feedback), not 3 |
| 9 | 4 agents at most. Layout rules: 1→full, 2→half/half, 3→grid, 4→2×2. Each tile scrollable. User input fixed at bottom | M3 | Implement these tile layout rules exactly. Already partially done in current `WorkerTile`; verify |
| 10 | PM-without-session may be confusing — user wants: (a) new mission while one is running → queue as to-do (b) mid-mission change → talk to worker OR terminate+replan via PM | M2 | Add: PM-side "terminate mission + re-plan" action; mission queue (#6 above); clarify in PM intro card |
| 11 | "What is this page?" — screen 13 (PRD.md) needs clearer identity | M5 | Add prominent "PRD.md" tab header + "PM's source of truth for this product" subtitle on the page |

**Decisions needed from user before M4 starts:**
- Comment #7: propose sequential per-worker approval (each annotation has its own send-back button to the specific worker; Archive is the final batch action). Confirm or counter-propose.
- Comment #10: confirm "terminate + replan" action lives on PM side, not worker side.

I'll re-surface these decisions when M4 / M2 milestone starts so they're fresh.

---

## What I learned this round (for future me)

- **Claude Design** is Anthropic Labs' AI design tool, launched April 2026, Opus 4.7-powered. When the user hands off a bundle from it, the bundle has README + chats + project files. The chats are where intent lives — read them first.
- Implementing from Claude Design = **1-to-1 translation of the JSX**, not "use the tokens and design my own". The wireframes ARE the spec.
- Bundle URLs return gzip — extract to `.design/` and read the README before anything else.
