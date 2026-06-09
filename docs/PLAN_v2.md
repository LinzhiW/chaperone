> ⚠️ **PARTIALLY SUPERSEDED (2026-06-09).** This screen-by-screen UI alignment plan
> predates the provider-agnostic pivot. Its **skill sections (§2, §4) are thinner
> than the real design** — the authoritative skill spec is now **[PRD.md](PRD.md)
> §7.2 + §7.2.2** (slot capacity, save-gated edits, three-tier authority, two modes,
> uniform injection). UI work is now **backend-first**: see [TODO.md](TODO.md) P6.
> The wireframe screen list below is still a useful index of the designed UI.

# Design Alignment Plan v2
**Spec:** Agent Company Wireframes _standalone_5.26.html  
**Journey:** docs/USER_JOURNEY.md  
**Design system:** .design/CLAUDE_CODE_DESIGN_SYSTEM.md (locked)  
**Rule:** One screen verified in browser → user sign-off → next. No silent batches.

---

## What M0 + M1 already did (keep, don't touch)

- CSS tokens in `src/index.css` (paper/ink/pm/worker/review/approve/warn + fonts)
- Shared components: `MissionRail`, `EmptyMissionRail`, `Sidebar`, `Sidebar_Empty`, `TopBar`, `BottomBar`, `PMShell`, `HitlCard`
- Screen 1.1 Welcome (Path A "Start from scratch" + Path B "Open folder" + Clone GitHub tiles) ✓
- Screen 1.4 Project ready (both variants: populated / empty) — partial ✓
- Backend endpoints all stay (execute-mission, reviewer, approve-action, branch-status, etc.)

---

## Section 1 · Onboarding

### 1-A · Screen 1.1 Welcome ✅ done (M1)
Minor gap: Path B button currently goes straight to `ready`, not to 1.2. Fix in 1-B.

### 1-B · Screens 1.2 + 1.3 — Path B folder analysis + HITL docs
**Source:** 5.26 screens 1.2, 1.3

- **1.2** PM analyzes folder — after folder picked, show PM Chat panel with:
  - System divider: `—— folder opened · ~/todo-app ——`
  - PM reads files (read_file tool calls shown with ✓)
  - PM asks: "Want me to draft PRD / SOP / Dev log?"
  - Quick-reply chips: "Yes — draft all three" / "Just PRD for now" / "Skip"
- **1.3** PM drafts docs one at a time — stepper (● PRD.md › ○ SOP.md › ○ Dev log.md):
  - HitlCard per file: `write_file · PRD.md · +62 lines` with Approve & write / Edit before write / Skip
  - Footer: "Skip remaining" / "Approve all three"
- On complete → 1.4 Project ready

**Backend:** `/api/init-project` already exists. New: actual PM call to generate docs content, `write_file` approval flow.

**Preview gate:** Open folder → see PM read files → approve PRD → screen moves to 1.4.

---

## Section 2 · Team

### 2-A · Screen 2.2 — Recruit worker (3-step modal/page)
**Source:** 5.26 screen 2.2

- Step 1: 7 role preset cards (Frontend/Backend/Mobile/QA/DevOps/Data/Custom), each with branch prefix + default skills
- Step 2: Skills loadout — pre-filled from preset, can swap/apply saved set/skip
- Step 3: Identity — display name, auto W-number, branch prefix, auto-dept
- Footer: Cancel / ✓ Hire · add to team

**Preview gate:** Recruit flow end-to-end → worker appears in sidebar Team section.

### 2-B · Screens 2.1 + 2.3 — Loadout (fresh hire + edit)
**Source:** 5.26 screens 2.1, 2.3

- **2.1** Fresh hire loadout: Equipped zone (empty drop target + saved set chips) + Library (10 skill cards with ⋮⋮ drag)
- **2.3** Edit loadout: same layout + unsaved indicator + Discard / Save as new set / Save · apply to Wx

**Preview gate:** Hire worker → open loadout → drag skill in → Save.

---

## Section 3 · Missions

### 3-A · Screens 3.1 + 3.6 — PM Chat (empty + idle)
**Source:** 5.26 screens 3.1, 3.6

- **3.1** Empty thread: PM opening message "Starting fresh." + input + 4 quick-start chips
- **3.6** Idle (between missions): running mission banner with queue + terminate link; PM welcome back message; 5 quick-chips
- Fix: replace current inline PM panel (uses old tokens) with PMShell component properly

**Preview gate:** PM Chat looks like wireframe. Running mission shows in banner with queue item.

### 3-B · Screen 3.7 — PM briefing (clarify scope)
**Source:** 5.26 screen 3.7 — **NEW, not in old plan**

- User sends brief → PM asks 3 structured questions (Scope / Who / Store)
- Each question has 3-4 chip options (user clicks instead of types)
- PM references PRD if answers conflict
- After chips answered → PM "reconciling" → "ready to draft"
- Buttons: "✎ Draft mission plan" / "Keep refining"

**Preview gate:** Send mission brief → see PM clarification chips → click answers → Draft plan button appears.

### 3-C · Screen 3.8 — PM drafting Mission Plan
**Source:** 5.26 screen 3.8 (similar to old PM_MissionPlan)

- Plan doc left (scrollable): PLAN tag + assignment cards (W1/W2/W3, branch, desc, skills, + skill)
- Sticky comments gutter right (280px): user comments with checkboxes + "Send all to PM" batch button
- Dispatch confirm bar (review-soft): "▶ Dispatch"
- Bottom composer: "Talk to PM — Split a task, change skills…"

**Preview gate:** Plan appears after 3-B. User adds sticky comment. Dispatch works.

### 3-D · Screens 3.2 + 3.9 — Mission dashboard (booting + running)
**Source:** 5.26 screens 3.2, 3.9

- **3.2** Just dispatched: event log "Mission dispatched · workers spinning up" + all tiles in ◐ booting
- **3.9** Running: 2×2 grid (layout: 1→full, 2→half, 3→grid, 4→2×2); each tile: worker color swatch + mono stream
- Mission strip: status + worker count + HITL count + Pause / ← PM panel

### 3-E · Screens 3.3 + 3.10 — Worker chat (booting + deep-dive)
**Source:** 5.26 screens 3.3, 3.10

- **3.3** Empty stream: "W1 has pulled skills and is reading brief." + right sidebar (loadout, files, commits, brief)
- **3.10** Deep-dive: full main area for one worker, chat history + stream + HITL inline + nudge

### 3-F · Screen 3.11 — HITL reject + rewrite
**Source:** 5.26 screen 3.11

- 3-action HITL: Approve / Reject + feedback / Reject + rewrite proposed command
- Equal columns when 4 workers
- Reject panel: ONE input box (not 3)

### 3-G · Screens 3.12 + 3.13 + 3.14 — Mission end + Reviewer + Archive
**Source:** 5.26 screens 3.12, 3.13, 3.14

- **3.12** All done: green status, Call Reviewer prominent
- **3.13** Reviewer report: sequential branches, 4 annotation types, individual send-back buttons
- **3.14** After archive: mission grays in sidebar, PM auto-sends message

### 3-H · Screens 3.15 + 3.16 + 3.17 — PM docs tabs
**Source:** 5.26 screens 3.15, 3.16, 3.17

- **3.15** PRD.md: structured doc + PM-proposed diffs + per-section HITL
- **3.16** SOP.md: stable structured doc + HITL on edits
- **3.17** Dev log.md: append-only feed of archive entries + raw edit mode

---

## Section 4 · Skills

### 4-A · Screen 4.1 — Skills library empty
**Source:** 5.26 screen 4.1

- "Build your skill library" empty state
- Buttons: `＋ New skill` / `Install 3 built-ins` / `Browse community (soon)`

### 4-B · Screen 4.2 — Skills library populated
**Source:** 5.26 screen 4.2

- Left sidebar: category filters + Saved sets panel + `＋ New category`
- Main: skill cards with source badges + usage count
- Saved sets section with `⊞ Compose a new set`

### 4-C · Screen 4.3 — Skill import
**Source:** 5.26 screen 4.3

- Tabs: Upload .md / GitHub link / Paste raw
- GitHub: fetch URL → content preview + metadata fields
- Equip immediately option
- Auto-resync from GitHub

### 4-D · Screen 4.4 — Compose skill set
**Source:** 5.26 screen 4.4

- Drag 4–6 skills into set
- Name + description + save target (private / shared / publish)
- Optionally seed onto role preset

---

## Order of execution

| # | What | Screens | Status |
|---|------|---------|--------|
| 0 | Foundation + shared primitives | — | ✅ done |
| 1 | Welcome (Path A/B entry tiles) | 1.1 | ✅ done (minor fix pending) |
| 2 | Path B: PM analyzes + HITL docs | 1.2, 1.3 | ⏳ |
| 3 | PM Chat empty + idle + queue | 3.1, 3.6 | ⏳ |
| 4 | PM briefing (clarify chips) | 3.7 | ⏳ |
| 5 | PM Mission Plan + sticky comments | 3.8 | ⏳ |
| 6 | Mission dashboard (booting + running) | 3.2, 3.9 | ⏳ |
| 7 | Worker chat (empty + deep-dive) | 3.3, 3.10 | ⏳ |
| 8 | HITL reject + rewrite | 3.11 | ⏳ |
| 9 | Mission end + Reviewer + Archive | 3.12, 3.13, 3.14 | ⏳ |
| 10 | PM docs tabs (PRD/SOP/Dev log) | 3.15, 3.16, 3.17 | ⏳ |
| 11 | Recruit worker | 2.2 | ⏳ |
| 12 | Loadout (fresh + edit) | 2.1, 2.3 | ⏳ |
| 13 | Skills library empty + populated | 4.1, 4.2 | ⏳ |
| 14 | Skill import | 4.3 | ⏳ |
| 15 | Compose skill set | 4.4 | ⏳ |

---

## Rules (unchanged from v1)

1. Read the wireframe section before touching code
2. 1-to-1 translation — no imagining missing parts
3. One screen → browser verify → user sign-off → next
4. Don't touch backend unless the screen explicitly needs it
5. Design tokens are locked — no new colors or components without asking
