# Change Log - Canopy

## [2026-06-09] — v2 direction reset: provider-agnostic + skill-loadout spec

### Changed (docs only — no code yet)
- **PRD rewritten to v2.1**: provider-agnostic platform (one pipeline + thin model
  adapters; Claude is *just a model*, no Agent SDK). Vendors = interchangeable model
  backends (Claude/GPT/Gemini/DeepSeek).
- **HITL model corrected**: from per-tool-call approval → **checkpoint-gated
  autonomy** (bounded autonomy + sensitive-action gate + hard stop at task boundary
  + human-gated merge). Added **per-worker mode** (default Auto). Anti-Paperclip
  invariant: never act/spend invisibly.
- **Two coordination layers** documented: communication (fan-out/fan-in) + integration
  (git). Git policy: load-bearing; no-git → auto-`git init` or single-worker mode.
- **Skill system spec locked** (PRD §7.2 + §7.2.2): three-tier authority (human >
  PM-suggest > system base), base set + ~8–10 custom slots, one neutral `SKILL.md`
  injected uniformly (no per-engine translation), save-gated edits, mid-mission edit =
  gate, PM suggest→accept·mount, token cost shown.
- **Audit**: global "designed vs built" gap table — the Skills system (4 screens) +
  Recruit + PM clarify are designed but unbuilt. Recorded in PROJECT_STATE.
- **New**: [TODO.md](TODO.md) phased backlog (P0–P6). DEV_PLAN.md marked superseded;
  PLAN_v2.md skill sections marked superseded by PRD.

### Not changed
- No production code touched this round. `server/src/index.ts` + `src/App.tsx`
  unchanged; refactor begins at TODO P1 (`ModelProvider` interface).

---

## [2026-05-19] — T8: GitHub PR trigger

### Added
- `POST /api/create-pr` endpoint: accepts `workspacePath`, `branch`, `title`, `body`; uses `execFile('gh', [...])` with args as array (no shell injection); returns `{ url }` from `gh pr create` stdout
- `ReviewerPanel` now has a live "Create PRs →" button: fires one request per assignment branch, PR body is pre-filled with branch annotations from the reviewer report
- PR results appear inline above the decision bar: each branch shows either a clickable GitHub PR URL or an error message
- Button states: `Create PRs →` → `Creating…` → `PRs created ✓`

---

## [2026-05-19] — T7: Reviewer Panel

### Added
- `GET /api/reviewer` SSE endpoint: accepts `workspacePath`, `branches` (JSON array), `tasks` (JSON map). Pulls `git diff main...{branch}` for each branch, sends all diffs to Gemini with a structured annotation prompt, streams `log` events then a single `annotations` event
- `ReviewAnnotation` type: `{ type: 'bug'|'note'|'bloat'|'missing'; branch; file?; line?; message }`
- `reviewerLog?: string[]` and `reviewerAnnotations?: ReviewAnnotation[]` added to `Mission` (persisted in localStorage)
- `ReviewerPanel` component: loading state (streams log), then branch-tab view with annotation list (4 type chips: 🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing) and decision bar (Send back / Archive to PM / Create PRs placeholder)
- `callReviewer(missionId)` — sets mission to `reviewing` status, opens SSE stream, stores annotations
- `archiveMission(missionId)` — sets status to `done`, navigates to PM panel, injects archive message into PM chat
- Mission strip and sidebar now show 3 states: `● Running` / `◑ Under review` / `○ Archived`

---

## [2026-05-19] — T6: Dashboard branch status

### Added
- `GET /api/branch-status` endpoint accepts `workspacePath` + `branches` (JSON array); uses `simpleGit` to compute `commits`, `files`, `ahead` per branch vs `main`; non-fatal per-branch failures return zeros
- `branchStats` state (`Record<branchName, {commits, files, ahead}>`) in App
- Polling effect: fires on mission view entry, polls `/api/branch-status` every 15s for the active mission's branches; stops when view changes
- WorkerTile accepts optional `branchStat` prop; header shows green `↑N · Mf` chip when the branch has commits or changed files

---

## [2026-05-19] — T5: Git branch auto-checkout

### Added
- `/api/execute-mission` accepts `branchName` param
- Before execution loop: `simpleGit` checks if workspace is a git repo, then `checkoutLocalBranch(branchName)` (new) or `checkout(branchName)` (existing); failure is non-fatal (logs warning, continues)
- Frontend passes `assignment.branchName` to execute-mission query string
- Worker log shows `[GIT] Created branch: feat/xxx` or `[GIT] Checked out existing branch: feat/xxx`

---

## [2026-05-19] — T4: Skill loadout injection

### Added
- `getSkillsDir()` resolves `~/.agents/skills` (overridable via `SKILLS_PATH` env)
- `listSkills()` scans skill folders, extracts `description` from frontmatter
- `readSkillContent(name)` case-insensitive match → reads `SKILL.md` content
- `GET /api/skills` endpoint returns `[{name, description}]` from local skills folder
- `/api/execute-mission` now accepts `skills` param (JSON array); builds `systemInstruction` with skill content injected — worker LLM follows skill guidance
- PM system prompt now includes full list of available skill names so the plan output uses real skill names
- Frontend: passes `assignment.skillLoadout` as `skills` to execute-mission
- Frontend: sidebar Skills section loads from `/api/skills` at runtime, shows all 31 real skills with tooltip descriptions; no longer hardcoded

---

## [2026-05-19] — T3: Per-panel backend session + functional nudge

### Added
- `panelSessions Map<panelId, {chat, workspacePath}>` persists each worker's `ChatSession` independently
- `activePanels Set` tracks which panels have a live SSE connection
- `POST /api/panel/:panelId/nudge` — continues the worker's existing chat session after execution ends; returns a busy message if SSE still active; surfaces tool requests without auto-executing
- WorkerTile nudge composer: real `<input>`, Enter key support, `[YOU] / [WORKER]` log lines, disabled while worker is proposed, send button highlights when input has content

---

## [2026-05-19] — T1 + T2: Structured task plan + Multi-panel architecture

### Added
- **T1 · PM structured output**: CEO system prompt now requires `<<<TASK_PLAN>>>` JSON block (`agent_id`, `task`, `branch_name`, `skill_loadout`). Frontend parses it and creates Assignment objects.
- **T2 · Mission + Assignment data model**: Replaced flat `Task[]` with `Mission` + `Assignment[]`. Missions persist in localStorage.
- **T2 · Sidebar restructure**: WORKSPACE → TEAM (PM + Departments) → MISSIONS → SKILLS. Mission items show numeric HITL badge.
- **T2 · PM Panel**: Identity bar (`plans · tracks · never executes`) + tab strip (Chat / PRD.md / SOP.md / Dev log.md) + running missions banner + quick-chip shortcuts.
- **T2 · Mission Plan dispatch card**: After PM outputs a plan, shows Assignment cards with branch/skill chips + orange "Dispatch" confirm area. Clicking Dispatch creates a Mission and switches to Mission Dashboard.
- **T2 · Mission Dashboard**: MissionStrip (status + HITL count + ← PM panel) + 2×2 worker tile grid + Reviewer strip. Each WorkerTile: color swatch + branch + status + stream log + inline HITL approval + nudge composer.

### Changed
- CEO → PM (Project Orchestrator) throughout UI and terminology.
- Task → Assignment, Session → Mission (aligns with DESIGN_LOG glossary).
- `[TASK: X, Y]` regex parser → `<<<TASK_PLAN>>>` JSON block parser.
- Dark Discord theme retained as default; warm white (wf-styles.css tokens) deferred to post-demo theming pass.

### Design decisions recorded
- **Visual theme freeze**: Warm white (`#faf7f0`) designated as future light/bright mode; current dark theme stays for demo. Full light/dark toggle planned after T5 (core flow working end-to-end). Design tokens from `wf-styles.css` saved for that pass.
- **Reviewed Claude Design bundle** (`Canopy Wireframes.html`): implementation aligns with DESIGN_LOG sections 1–9. Phase 2 items (PRD.md tab, sticky comment gutter, Reviewer report, Archive → dev log) deferred.
- **Negated patterns respected**: no "Talk to PM" in mission view, no auto-dispatch, no QA dept.

## [2026-04-26] - Phase 3 & 4 Milestone: Tool-Using Agents

### Added
- **Gemini Integration**: Backend now uses `@google/generative-ai` with Gemini 1.5 Pro.
- **Function Calling**: Agents now have "hands" via `run_shell`, `read_file`, and `write_file` tools.
- **SSE Terminal**: Real-time streaming logs from backend to frontend terminal UI.
- **Human-in-the-Loop (HITL)**: Action-level approval system. Every tool call pauses for user permission.
- **CEO Orchestrator**: Functional chat interface that can perceive local project files and propose tasks.
- **UI Collapsibility**: All sections in the middle column (Files, Sessions, Depts, Skills) are now collapsible.

### Changed
- **Local-First Architecture**: Moved from static mockups to a functional system that inherits local terminal authentication (OAuth/gcloud/git).
- **Workspace Logic**: Moved Workspace path selection to the top of the middle column for better IDE experience.
- **Security**: Implemented B-Plan security: API keys are saved to local `.env` via backend API, excluded from Git.

### Fixed
- Fixed multiple React styling syntax errors (camelCase conversion).
- Fixed UTF-8 encoding for specialized icons.
