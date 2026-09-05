# Chaperone — User Interaction Journey
**Derived from:** Chaperone Wireframes _standalone_5.26.html  
**Date:** 2026-05-27

---

## Entry — 1.1 Welcome (two paths)

**PATH A — Start from scratch**
- Empty PM chat, no memory, no docs, no codebase
- → 3.1 PM Chat (first open, empty thread)

**PATH B — Open local folder / Clone from GitHub**
- PM opens folder, reads files (README, package.json, tree, App.tsx)
- → 1.2 PM analyzes folder (normal agent chat, read_file tool calls shown)
- PM asks: "Want me to draft PRD / SOP / Dev log?"
- Quick-reply chips: "Yes — draft all three" / "Just PRD for now" / "Skip — start working"
- → 1.3 PM drafts PRD / SOP / Dev log (HITL per file — Approve & write / Edit before write / Skip this one)
- Stepper: ● PRD.md › ○ SOP.md › ○ Dev log.md
- Footer: "Skip remaining" / "Approve all three"
- → 1.4 Project ready (sidebar fully populated: files, team, missions, skills)

---

## Main Loop — Missions

### Step 1: Brief PM
**3.1 PM Chat — first open (empty thread)**
- PM says: "Starting fresh. No history, no docs, no missions."
- Input: "What's our first mission?"
- Quick chips: Plan a feature / Plan a refactor / Audit the codebase / Set up CI / SOP

**3.6 PM Chat — idle (between missions)**
- PM says: "Welcome back. 1 mission still running (Dark mode, 2 HITL pending)."
- Mission running banner: "1 mission running — PM doesn't intervene unless you ask. New briefs queue behind it."
  - Shows queue: running mission chip + queued items with `terminate current →` link
- Quick chips: Scope screens for design / Update PRD / Summarize dev log / Plan a new mission / Audit current missions

### Step 2: PM clarifies scope
**3.7 PM briefing a new mission**
- User sends need (e.g. "let's add a way for users to share their TODO list")
- PM asks 3 structured questions before drafting — each with chip options:
  - **Scope:** Read-only link / Edit together / Comment-only
  - **Who:** Anyone with URL / Registered users / Same Apple ID
  - **Store:** Server-side / P2P / CRDT / Static export only
- PM references PRD if answers conflict with existing decisions
- After chips answered → PM "reconciling" → "ready to draft"
- Buttons: "✎ Draft mission plan" / "Keep refining"

### Step 3: PM drafts plan
**3.8 PM drafting Mission Plan**
- Plan doc (left, scrollable): PLAN header + assignment cards (W1/W2/W3 with branch, desc, skills, `+ skill`)
- Sticky comments gutter (right): user adds comments on specific assignments, checkbox to include in batch
  - "Send all to PM — revise plan" button → PM batch-updates in one pass
- "Confirm before dispatch" bar (review-soft bg): "Dispatch? 3 workers briefed. Each tool call still needs HITL."
- ▶ Dispatch button
- Bottom composer: "Talk to PM — Split a task, change skills, answer an open question…"

### Step 4: Mission running
**3.2 Mission dashboard — just dispatched**
- Event log: "Mission dispatched · workers spinning up"
- 4 worker tiles: W1/W2/W3 ◐ booting, W4 ◌ queued
- Each tile: "talk to W1…" input

**3.9 Mission running dashboard**
- 2×2 worker tile grid (layout rules: 1→full, 2→half/half, 3→grid, 4→2×2)
- Mission strip: running status + worker count + HITL pending count + Pause / ← PM panel

**3.3 Worker chat — just opened (empty stream)**
- Worker booting state: "W1 has pulled skills and is reading assignment brief"
- Right sidebar: Loadout (skills), Files touched, Commits, Assignment brief
- Input: "Tell W1 where to start — e.g. use CSS variables…"

**3.10 Worker chat — W1 deep-dive**
- Single worker takes full main area
- Chat history + stream log + HITL inline + nudge composer

**3.11 HITL — reject + rewrite**
- 3-action HITL: Approve / Reject + feedback / Reject + rewrite proposed command
- Layout: equal columns when 4 workers; reject panel has ONE input (feedback), not 3

### Step 5: Mission ends
**3.12 Mission — all workers done**
- Green status everywhere
- "Ready to archive" CTA
- Call Reviewer button prominent

**3.4 Reviewer — just summoned**
- Sequential per-branch scan: W1 ● scanning, W2 ○ next, W3/W4 ◌ queued
- Each branch tile shows diff stats
- ~30s per branch, ~2 min total

**3.13 Reviewer — cross-branch report**
- 4 annotation types: 🐛 Bug · ℹ Note · 🧹 Bloat · ❓ Missing
- Sequential per-branch (NOT parallel progress bars)
- Each annotation has individual "send back to Wx" button
- Archive is the final batch action

**3.14 After archive**
- Mission moves to "Archived" in sidebar (grayed)
- PM auto-sends first (only time PM initiates): "Got the report. Wrote entry to Dev log.md and queued 3 PRD edits."
- Toast confirms archive

### Step 6: PM docs update
**3.15 PM · PRD.md** — structured doc, PM proposes inline diffs with per-section HITL  
**3.16 PM · SOP.md** — stable structured doc, HITL on edits  
**3.17 PM · Dev log.md** — append-only feed; each entry = past reviewer report; can edit raw

---

## Side Path — Team

Accessed via sidebar Team section → `＋`

**2.2 Recruit — new worker (3 steps)**
1. **Role preset:** Frontend / Backend / Mobile / QA / DevOps / Data / Custom
   - Each preset ships with default skills
2. **Skills (optional):** Pre-filled from preset; can swap, apply saved set, or `Skip · do it later`
3. **Identity:** Display name, auto-assigned W-number, branch prefix, auto-dept

**2.1 Loadout — worker just hired (0 skills)**
- Equipped zone: empty drop target + saved set chips
- Library section: 10 skills with ⋮⋮ drag handles

**2.3 Loadout — edit existing worker's skills**
- Same layout as 2.1 but with existing equipped skills
- Unsaved change indicator + Discard / Save as new set / Save · apply buttons

---

## Side Path — Skills

Accessed via sidebar Skills section

**4.1 Skills library — empty (fresh install)**
- Empty state: "Build your skill library"
- Buttons: `＋ New skill` / `Install 3 built-ins` / `Browse Skill community (soon)`
- Suggested starters: TDD-Expert · Conventional-Commits · a11y-audit

**4.2 Skills library — populated**
- Left: category filters (All / Frontend / Backend / etc.) + `＋ New category` + Saved sets panel
- Main: 10 skill cards (name, source badge, description, category, used-by count)
- Below cards: Saved sets section with `⊞ Compose a new set` CTA

**4.3 Skill import/new**
- 3 tabs: Upload .md / GitHub link / Paste raw
- GitHub: fetch URL → show content preview + metadata fields (Name / Category / Description)
- Equip immediately option: nobody / specific worker / all role workers
- Source note: GitHub auto-resyncs on file change

**4.4 Compose skill set**
- Pick 4–6 skills from library via drag
- Set name + description + save target (private / shared / publish)
- Optionally seed onto a role preset

---

## Key State Transitions

| Trigger | State change |
|---------|-------------|
| Path A chosen | → PM Chat empty, sidebar shows PM only |
| Path B folder opened | → PM Chat 1.2, PM reads files |
| All docs approved (1.3) | → 1.4 Project ready, full sidebar |
| Mission Dispatched | → PM exits, Mission dashboard opens |
| New brief while mission running | → queued in PM Chat banner |
| `terminate current →` clicked | → running mission terminated, queued brief promoted |
| Archive clicked | → mission grays in sidebar, PM auto-sends message |
| Worker hired (2.2) | → appears in Team section sidebar |
| Skill added (4.3) | → appears in library, available in loadout/recruit |

---

## Sidebar Active State by Section

| Section | Sidebar active |
|---------|---------------|
| 1.1 Welcome | MissionRail hidden, EmptyMissionRail |
| 1.2–1.4 Onboarding | Team → PM (PM is active) |
| 3.x PM Chat/Plan | Team → PM |
| 3.x Mission/Worker | Missions → active mission |
| 2.x Team | Team → specific worker |
| 4.x Skills | Skills section |
