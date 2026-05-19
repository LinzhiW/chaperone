# Change Log - Agent Company

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
- **Reviewed Claude Design bundle** (`Agent Company Wireframes.html`): implementation aligns with DESIGN_LOG sections 1–9. Phase 2 items (PRD.md tab, sticky comment gutter, Reviewer report, Archive → dev log) deferred.
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
