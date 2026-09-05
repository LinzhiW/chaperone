# Claude Code ↔ Claude Design — Shared Change Log

This document is maintained by Claude Code and tracks:
- what design deliverables were received and when
- what code was built in response
- what is still pending
- design decisions that diverged from the spec (so Claude Design can re-align)

Convention matches DESIGN_LOG.md: `═══ DELIVERY N ═══` dividers mark each handoff. Claude Design can read this via GitHub to know exactly what state the code is in.

---

═══════════════════════════════════════════════════════════
 DELIVERY 1 · 2026-05-18 · Received + built by Claude Code
═══════════════════════════════════════════════════════════

## What was received (Delivery 1)

- DESIGN_LOG.md §1–§14 (initial 21-wireframe spec)
- Terminology lock: Mission / Assignment / Dispatch / Archive / PM / Worker
- Hard constraints: HITL non-negotiable, PM never enters running mission, PM never writes code, branches for coordination
- 8-phase execution plan (CLAUDE_CODE_KICKOFF.md)

## What was built (T1–T6, all 2026-05-19)

### T1 · PM structured output
- PM system prompt requires `<<<TASK_PLAN>>>` JSON block: `agent_id`, `task`, `branch_name`, `skill_loadout`
- Frontend parses block → creates Assignment objects
- Replaced `[TASK: X, Y]` regex with structured function-calling-style output

### T2 · Multi-panel UI + data model
- `Mission` + `Assignment[]` data model, persisted to localStorage
- Sidebar: WORKSPACE → TEAM (PM + Departments) → MISSIONS → SKILLS
- PM Panel: identity bar + tab strip (Chat / PRD.md / SOP.md / Dev log.md) + running missions banner + quick-chip shortcuts
- Mission Plan dispatch card: Assignment cards with branch/skill chips + orange Dispatch area
- Mission Dashboard: MissionStrip (status + HITL count + ← PM panel) + 2×2 worker tile grid + Reviewer strip
- WorkerTile: color swatch + branch + status + stream log + inline HITL + nudge composer
- CEO → PM throughout; Task → Assignment; Session → Mission

### T3 · Per-panel backend session
- `panelSessions Map<panelId, {chat, workspacePath}>` — each worker has an independent ChatSession
- `activePanels Set` — tracks live SSE connections
- `POST /api/panel/:panelId/nudge` — continues existing session after execution ends

### T4 · Skill loadout injection
- `getSkillsDir()` resolves `~/.agents/skills` (overridable via `SKILLS_PATH` env)
- `readSkillContent(name)` injects skill `.md` into worker system prompt
- `GET /api/skills` → frontend sidebar loads real skills from disk (no hardcoded list)
- PM system prompt lists available skill names so plan output uses real names
- Frontend passes `assignment.skillLoadout` as `skills` to execute-mission

### T5 · Git branch auto-checkout
- `simpleGit` checkout before execution loop; `checkoutLocalBranch` (new) or `checkout` (existing)
- Non-fatal: failure logs a warning, execution continues
- Frontend passes `assignment.branchName` to execute-mission

### T6 · Dashboard branch status
- `GET /api/branch-status?workspacePath=...&branches=[...]` — `simpleGit` computes `commits`, `files`, `ahead` vs `main` per branch
- `branchStats` state in App, polled every 15s on mission view entry
- WorkerTile header shows green `↑N · Mf` chip when branch has commits or changed files

## CSS token refactor (also 2026-05-19)

CLAUDE_CODE_REFACTOR_TOKENS.md called for Tailwind theme tokens. Because App.tsx uses 100% inline React style props (no Tailwind classes), we instead:

- Added 30+ CSS custom properties to `src/index.css` (`:root` block, dark theme)
- Replaced all hardcoded hex/rgba colors in App.tsx with `var(--token)` references
- Token map:

| Token | Value | Role |
|-------|-------|------|
| `--bg-deep` | `#17181c` | deepest surface / rail |
| `--bg-base` | `#1b1c20` | app background |
| `--bg-surface` | `#1f2125` | sidebar / panels |
| `--bg-elevated` | `#25272d` | cards |
| `--bg-raised` | `#2a2c33` | raised cards |
| `--bg-tile` | `#232529` | worker tiles |
| `--bg-code` | `#0f0f0f` | code blocks |
| `--bg-user-msg` | `#2d3163` | user chat bubbles |
| `--bg-hitl` | `#2d2210` | HITL prompt background |
| `--bg-hitl-inner` | `#1e1508` | HITL inner |
| `--bg-running` | `#0f2d1a` | running state indicator |
| `--text-primary` | `#e6e7ea` | primary text |
| `--text-secondary` | `#b3b5bd` | secondary text |
| `--text-label` | `#8a8d97` | labels |
| `--text-muted` | `#7d808a` | muted text |
| `--text-dim` | `#5a5c66` | dimmed text |
| `--accent-pm` | `#5b6ef2` | PM / primary action |
| `--accent-ok` | `#3ba55d` | approve / success |
| `--accent-warn` | `#c97a3a` | HITL / review / warning |
| `--accent-danger` | `#f23f43` | reject / error |
| `--accent-skill` | `#a78bfa` | skills |
| `--accent-git` | `#4a7c4a` | git / branch |
| `--border-subtle` | `rgba(255,255,255,0.06)` | faint borders |
| `--border-default` | `rgba(255,255,255,0.08)` | standard borders |
| `--border-strong` | `rgba(255,255,255,0.10)` | stronger borders |
| `--gradient-logo` | `linear-gradient(135deg,#6477ff,#5b6cf2 50%,#7c6dff)` | logo gradient |
| `--log-exec` | `#e8c643` | shell command log lines |
| `--log-output` | `#5b8fa8` | output log lines |

Intentionally kept as literals:
- `WORKER_COLORS` array (`['#5d8aa8','#87a36d',...]`) — pure data, not theme
- `#fff` in button text on colored backgrounds — white is correct in both themes

**Note for Claude Design:** DESIGN_LOG token names (`--surface-0`, `--ink`, `--pm`, `--approve`, etc.) differ from what we used. When light theme values are finalized, we can rename the tokens to match the spec. The mapping would be roughly: `--bg-surface` → `--surface-1`, `--accent-pm` → `--pm`, `--accent-ok` → `--approve`, `--accent-warn` → `--review`, etc.

---

═══════════════════════════════════════════════════════════
 DELIVERY 2 · 2026-05-19 · Received — build pending
═══════════════════════════════════════════════════════════

## What was received (Delivery 2)

- DESIGN_LOG.md §15 — alignment gap analysis (priority guide for this phase)
- CLAUDE_CODE_KICKOFF.md — 8-phase updated execution order, conflict policy (design wins)
- CLAUDE_CODE_REFACTOR_TOKENS.md — token refactor brief (done with CSS vars, see above)
- `Chaperone Wireframes.html` — 21 wireframes, 7 user-journey sections
- `Dashboard Hi-Fi.html` — standalone hi-fi mockup
- chat3.md — 11 comments from Linzhi to Claude Design (see §Unprocessed Comments below)

## Pending builds from Delivery 2

Ordered by execution plan (CLAUDE_CODE_KICKOFF.md phases):

| Item | Source | Status |
|------|--------|--------|
| **T7 · Reviewer panel** | DESIGN_LOG §15.6, wireframe 11 | ⏳ next |
| Mission state machine extension | DESIGN_LOG §15.7, wireframe screens 5-12 | ⏳ |
| PM Brief + Plan flow (wireframes 5+6) | Structured function-calling plan output | ⏳ |
| Worker chat deep-dive (wireframes 8+9) | Full-screen click-in + HITL reject A/B | ⏳ |
| Mission ending: Done→Reviewer→Archived | Reviewer report → Archive to Dev log | ⏳ |
| PM memory tabs: PRD/SOP/Dev log | DESIGN_LOG §15.4, screens 13-15 | ⏳ |
| Skills system (screens 17-20) | Library, import, per-worker loadout | ⏳ |
| Recruit worker (screen 16) | 3-step modal, 6 role presets | ⏳ |

### T7 Reviewer panel — spec

Per DESIGN_LOG §15.6 and wireframe screen 11:

- **Branch ribbon** at top: one tab per completed branch
- **Annotation stream**: 4 types — 🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing
- Each annotation: file path + line range + severity chip + expandable diff snippet
- **Cross-branch view**: right gutter shows W1 vs W3 conflicts when same file touched by two workers
- **Decision bar** (sticky bottom): `Send back to worker` / `Archive to PM` / `Create PRs`
- Send back → annotation + feedback text → reopens that worker's session
- Archive → writes summary to Dev log.md in `~/<project>/.agent-company/`

### Mission state machine — target states

```
idle → briefing → planning → running → reviewing → archived
```

Current code has: `proposed / running / done`

Mapping: `proposed` → split into `briefing` + `planning`; `done` → split into `reviewing` + `archived`

---

## Unprocessed comments (chat3.md — Claude Design had no usage to respond)

These 11 comments from Linzhi were submitted to Claude Design but not answered before usage ran out. Grouped by type:

### Pure design — needs Claude Design response when usage returns

1. **Screen 20 alignment** (`b99692ec42-div-588-15`): Align screen 20's section layout to match screen 19.
2. **Edit worker skills entry point** (screen 19 left column): Left sidebar shows "Skills" selected, not a specific worker — entry point is unclear. Should select a worker from Team, then edit their skills.
3. **User-created category page** (`332620e387-div-325-19`): Missing a page for user-created skill categories. Should be added at Skill Library > category area.
4. **Skill components not applied uniformly** (screen 17 left sidebar): Skill component design varies across pages; left column is inconsistent.

### Code-actionable — implement when Claude Design confirms

5. **Recruit step 2 skip** (`df070e6cc5-div-52-17`): Step 2 (assign skills) should have a "Skip / do later" option — not every worker needs skills. *(Code: add Skip button to step 2 of recruit modal)*
6. **PM panel — one mission at a time clarification** (screen 13 PM tab): Currently only one running mission allowed. User wants to clarify: new mission queues as "to-do" (can chat about it with PM), user can also terminate current mission and re-plan. *(Code: mission queue state + PM "terminate + re-plan" action)*

### Already implemented

7. **Equal tiles + scrollbar + fixed input** (`ebd7627b99-div-43-13`): Max 4 workers; 1→full, 2→half/half, 3→grid, 4→2×2; each tile scrollable; user input always fixed at bottom. **Already implemented in T5/T6 tile layout.**

### Design discussion — design decision needed first

8. **Reviewer sequential vs batch** (`746f3b047f-div-129-15`): Should reviewers approve each worker's output individually before a final overall approval? W1/W3 mixed in right column is confusing.
9. **W1 HITL reject inputs** (`f99f57b6cc-div-174-13`): Split-screen is not 4 equal columns; W1 has 3 input boxes on reject (too many).
10. **PM panel rethink — single PM concern** (screen 13): PM without per-mission context may be confusing. User's analysis: ok to return to PM between missions; PM can queue new missions; PM can terminate + re-plan current mission. Final worry: is "always one PM panel" an innovation or anti-pattern vs. tabbed model? *(Claude Design to decide UI implications.)*
11. **Screen 13 "what is this page?"** (`512e329485-div-121-13`): User wasn't sure what screen 13 shows. *(Claude Design to clarify / label the screen better.)*

---

## Design decisions where code diverged from spec

| Spec | Code | Reason |
|------|------|--------|
| Tailwind theme tokens (`--surface-0`, `--ink`, etc.) | CSS custom properties with different names | App.tsx uses 100% inline styles; full Tailwind migration = full rewrite |
| Light/warm theme (`#faf7f0` wf-styles.css) | Dark theme only (current demo) | Core flow stability first; light theme after T7 |
| Delivery 2 execution order (Phase 1 = naming + token) | Token done; naming = CEO→PM done; other phases pending | Naming was done in T2; tokens done now |

---

## Next sync point

When Claude Design usage returns and these are ready, sync on:
1. Screen 20 alignment fix + screens 17/19 skill component consistency
2. Recruit step 2 skip option
3. Reviewer sequential vs batch decision → then T7 implementation
4. PM panel "one PM" model — confirm or propose alternative

Token naming: once light theme values are tuned, we will rename tokens to match the DESIGN_LOG spec names (`--surface-0` etc.) in a single find-replace pass.
