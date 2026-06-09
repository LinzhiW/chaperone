# Agent Company — Frontend Design System (locked)

**Status:** UI handoff. This document is the **single source of truth for visuals**. It supersedes everything in `CLAUDE_CODE_REFACTOR_TOKENS.md` (Discord-era tokens) and any inline-style colors still in `src/`.

**Read this first:** `Agent Company Wireframes.html` (open in the project, click any artboard to focus). The 4 sections in that file — **1 Onboarding · 2 Team · 3 Missions · 4 Skills** — are the canonical reference. **Match the wireframes, then iterate on content.**

> Hard rule: **UI first, content second.** Get the shell, tokens, and component vocabulary right; once they match the wireframes, content (copy, mission names, file lists) can flex.

---

## 1 · Design tokens

### 1.1 Colors

Define these as CSS variables on `:root`, then expose to Tailwind as semantic tokens. **No literal hex anywhere in components.**

```css
:root {
  /* Surfaces — light theme (only theme right now) */
  --paper:   #faf7f0;   /* primary page background */
  --paper-2: #f3efe5;   /* secondary surface — sidebar, topbar, bottombar */

  /* Ink (text) */
  --ink:   #1f1d1a;     /* primary text + emphasis */
  --ink-2: #5a5750;     /* secondary text, body copy */
  --ink-3: #948f84;     /* tertiary text, hints, captions */

  /* Rules (borders) */
  --rule:        #1f1d1a;            /* primary border — full opacity ink */
  --rule-soft:   rgba(31,29,26,0.35); /* subtle dividers */
  --rule-dashed: rgba(31,29,26,0.5);  /* dashed callouts only */

  /* Roles (semantic) */
  --pm:          #3b6aa8;  --pm-soft:      #d9e4f2;  /* PM agent + memory */
  --worker:      #6b4e7f;  --worker-soft:  #e6dded;  /* worker chips, skill chips */
  --review:      #c97a3a;  --review-soft:  #f4dfc6;  /* HITL pending, reviewer */
  --approve:     #4a7c4a;  --approve-soft: #d5e6cf;  /* success, running, approve */
  --warn:        #c9554a;                            /* reject, error */

  /* Accents (UI scaffolding) */
  --highlight: #f5d76e;  /* yellow badge */
  --comment:   #fff3b8;  /* sticky note background */

  /* Per-worker swatches (W1–W4 — used in dashboards, mission rail) */
  --w1: #5d8aa8;  /* ui-worker */
  --w2: #87a36d;  /* api-worker */
  --w3: #c98a5a;  /* infra-worker */
  --w4: #a86970;  /* test-worker */
}
```

**Color-use rules:**
- Pick by **role**, not appearance. A "running" indicator is `approve` even if you later change green to teal. HITL pending is `review`. PM is `pm`. Workers in chat are `worker`. Reject + errors are `warn`.
- Surfaces: artboard background is always `paper`. Sidebar / topbar / bottombar / cards-on-cards step down to `paper-2`. Never use pure white.
- Soft variants (`*-soft`) are **only for backgrounds with a same-role text/border on top** (e.g. `bg-pm-soft text-pm border-pm`). Don't use a soft as standalone text or border.
- Dark theme is **out of scope right now.** Don't tune it.

### 1.2 Typography

```css
:root {
  --sans: "Inter", -apple-system, system-ui, sans-serif;
  --mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  --hand: "Caveat", "Patrick Hand", "Comic Sans MS", cursive;
}
```

- **Sans** — default for all UI text.
- **Mono** — file paths, commit hashes, branch names, terminal output, tool-call names, keyboard hints, IDs (W1, M-203), tab labels that look like file names (`PRD.md`).
- **Hand** — wireframe-only callouts and arrows. In production this is **the user's casual cursive voice** ("↓ start typing below", "you can cancel and iterate further"). Use sparingly — 1 callout per screen max.

Size scale (in px — keep tight):

| Token   | px | Use                                              |
|---------|----|--------------------------------------------------|
| xs      | 9  | uppercase section labels, badges                 |
| sm      | 10 | mono captions, status pills, secondary metadata  |
| base-sm | 11 | mono code, dense metadata                        |
| base    | 12 | body copy, secondary UI                          |
| md      | 13 | primary UI text, nav items, chat bubbles         |
| lg      | 14 | section headers, mission titles                  |
| xl      | 15–16 | doc titles, modal titles                      |
| 2xl     | 17–22 | onboarding hero, page headlines               |
| 3xl     | 32–34 | welcome hand-drawn hero only                  |

Line-height: 1.5–1.7 for body, 1.1–1.3 for headlines.

### 1.3 Radii + shadows

```css
:root {
  --radius-card: 4px;
  --radius-soft: 5–6px;   /* PM doc, worker tile */
  --radius-pill: 999px;   /* status chips, badges */
}
```

- Shadows: **almost never.** Cards rely on borders, not elevation. Only a sticky note has `box-shadow: 0 1px 0 rgba(0,0,0,0.05)`.
- Borders: always `1px` or `1.5px solid var(--rule|rule-soft)`. Dashed (`1.5px dashed var(--rule-dashed)`) is reserved for "draft / empty / placeholder" states.

### 1.4 Spacing

Use Tailwind's default 4px scale. Common patterns:

| Use                          | Value     |
|------------------------------|-----------|
| Inline gaps in a row         | 6–10px    |
| Card inner padding           | 10–14px   |
| Section gaps in a panel      | 12–16px   |
| Page padding (around scroll) | 14–18px   |
| Card border-radius           | 4px       |

---

## 2 · Layout shell

**Every screen** uses the same 4-zone shell:

```
┌──────────────────────────────────────────────────┐
│  TopBar (paper-2 · 1.5px ink border-bottom)      │  ← title, status chips
├────────┬─────────────────────────────────────────┤
│        │                                         │
│Sidebar │  Main panel (paper-2 background)        │
│paper-2 │                                         │
│        │    (PM panel · mission dashboard ·      │
│        │     worker chat · docs · etc.)          │
│        │                                         │
├────────┴─────────────────────────────────────────┤
│  BottomBar (paper-2 · 1.5px ink border-top)      │  ← model · tokens · status
└──────────────────────────────────────────────────┘
```

- Sidebar width: `200px` fixed, `paper-2` bg, `1.5px solid ink` right border.
- TopBar/BottomBar: `1.5px solid ink` divider on the inside edge.
- Scrolling: only the inner scroll regions scroll. TopBar, Sidebar, BottomBar are sticky.
- Always set `min-height: 0` on flex parents that contain a scrollable child — otherwise the scrollbar disappears.

### 2.1 The optional MissionRail (leftmost dark rail)

`60px` wide, `#1a1816` background, `1.5px solid ink` right border. Shows the workspace switcher + a `+` to start a project. **Only present when the user has at least one project open.** Hidden on the Welcome screen.

---

## 3 · Components catalog

Each component below has a fixed structure. Names map to the JSX components in `wf-shared.jsx` / `wf-pm.jsx` / `wf-onboarding.jsx`. The wireframe is the visual source of truth.

### 3.1 `TopBar`
- Left: page title (`md`, weight 600) + optional mono submission name.
- Right: status chips (running / idle / pending HITL).
- Chip = `paper` bg, `1px rule-soft` border, `999px` radius, `4px 10px` padding, `12px` text. Dot prefix: 7×7 circle, color matches state (`approve` / `review` / `warn`).

### 3.2 `Sidebar` (full)
**Used on:** any screen where the user has a populated workspace with workers / missions / skills (3.6+, 3.9+, 2.x post-recruit).

Structure top → bottom, separated by `gap: 16px`:
1. **Files** — folder icon + uppercase 10/700 caps label. Below: `~/<repo>` mono box + `main · clean` mono caption.
2. **Team** — people icon + caps label + `+` add affordance. Then: PM row (always present, `pm` color dot + 💬 affordance), then `▾ Frontend Dept` subhead → ui-worker row, `▾ Backend Dept` subhead → api-worker row. Active worker row gets `ink` background + `paper` text + small `W1` mono pill.
3. **Missions** — clipboard icon + caps label + `+`. List active missions with HITL-pending badge (`review` bg, `paper` text, `999px`, count). Plus `＋ new mission` ghost row.
4. **Skills** — bolt icon + caps label + `+`. Flat list with `✓` / `○` prefix.
5. **Profile · Settings** at the bottom (no top border separator).

### 3.3 `SidebarCollapsed`
**Used on:** onboarding 1.2 / 1.3, recruit, and any screen where the user has no team / missions / skills to show yet. Same 4 + 2 items but only the row (icon + label + caret + optional `+`). When `active === "team"` and `subActive === "pm"`, indent a small PM accent row (`pm-soft` bg, `2px solid pm` left border, `pm` text) directly below Team.

Active row: `ink` bg, `paper` text. Caret: `▾` on active, `▸` on collapsed. `+` button on Team / Missions / Skills (not Files); recolors to match active state.

### 3.4 `PMShell`
The PM panel's tab strip + identity bar + mission banner + body slot.

- Identity bar: PM swatch (`pm` bg, `paper` text), title "Project Orchestrator", caption "plans · tracks · never executes · one PM per project · one mission at a time", right-aligned "memory: …".
- Tab strip: `Chat` always. With `hideDocs={true}`, hide PRD.md / SOP.md / Dev log.md. Otherwise show all four. Active tab: `paper` background, `1.5px rule` border, `1.5px paper` bottom border (overlap the strip rule). Mono font for `*.md` tabs.
- Mission banner (only when `runningMission` is non-null): `approve-soft` bg, `1px approve` border, "1 mission running" + active mission chip. Queued missions appear behind it as muted chips.

### 3.5 `MissionStrip`
A page-level banner for the active mission. Shows mission name, status pill (`running` / `review` / `done`), worker count, HITL pending count.

### 3.6 `WorkerTile`
Used on the 2×2 mission dashboard. Card with:
- Header: 10×10 swatch (worker color, w1..w4), `wt-name` (mono 12/600), branch (mono 10), status pill on the right (`run` / `wait` / `idle`).
- Body: scrollable, mono 10–11, lines color-coded — `.agent` (ink), `.tool` (pm), `.ok` (approve).
- Optional composer at the bottom of the tile (single-line input + send button).

### 3.7 `HitlCard`
The single most important component. Used **anywhere a tool call needs approval**.
- `1.5px review` border, `#fdf6e8` bg (a softer review tint).
- Header: `⚠` + "Tool call awaiting approval" + tool name on right.
- Body: mono code block, dashed `rule-soft` border, `paper` bg, `pre-wrap` to preserve newlines.
- Actions: green Approve (filled `approve`), bordered Reject (`warn`), `y / n` kbd hint.

### 3.8 Sticky note (comments / inline annotations)
`comment` bg, `#d6b94c` border, hand font 14/1.25, `#5a4a1a` text, a small ALL-CAPS "WHO" line above. Used for PM-on-plan stickies, reviewer findings.

### 3.9 Branch chip
Mono 10, `paper` bg, `1px rule-soft` border, leading `⎇` glyph. Inline display.

### 3.10 Composer (chat input)
`1.5px rule` border, `paper` bg, `8px 10px` padding, `12px` placeholder text (`ink-3`). Right-aligned send button: `26×22`, `ink` bg, `paper` text, `↵`.

### 3.11 Annotation types (reviewer)
Four fixed types — names + icons are part of the brand and must not change:
- 🐛 **Bug** — `warn` text/border
- ℹ **Note** — `pm` text/border
- 🧹 **Bloat** — `ink-2` text/border
- ❓ **Missing** — `review` text/border

### 3.12 Buttons
- Primary (filled ink): `var(--ink)` bg, `var(--paper)` text, `1.5px solid ink`, `4px` radius.
- Primary (filled pm): when the action is PM-led ("Start →" on Path A welcome).
- Secondary (ghost): `paper` bg, `1.5px rule` border, `ink` text.
- Approve: `approve` bg, `paper` text. Reject: `paper` bg, `warn` text + border.
- All buttons: `12px` text, `6–8px` y padding, `12–14px` x padding, `4px` radius.

---

## 4 · Vocabulary lock

These names appear in UI strings and **must not drift**:

| Concept                | UI name           | Notes                                              |
|------------------------|-------------------|----------------------------------------------------|
| Project orchestrator   | **PM**            | Never "CEO", "Manager", "Lead".                    |
| Unit of work           | **Mission**       | Never "Session" or "Task".                         |
| Sub-unit of a mission  | **Assignment**    | One assignment per worker per mission.             |
| Triggering a mission   | **Dispatch**      | The button that exits planning, starts running.    |
| Closing a mission      | **Archive**       | Writes the reviewer report to Dev log.md.          |
| Agent that codes       | **Worker**        | Plural: workers. Identified W1, W2, … globally.   |
| Per-worker git branch  | **Branch** (mono) | Always shown with `⎇` prefix.                      |
| PM long-term docs      | **PRD.md / SOP.md / Dev log.md** | Always mono, always with `.md`.        |
| Reusable skill         | **Skill**         | Markdown file injected into a worker's prompt.     |
| Reusable bundle        | **Skill set**     | Composable group of skills.                        |
| Tool-call approval     | **HITL approval** | Never "confirm" or "permission".                   |
| Reviewer types         | 🐛 Bug · ℹ Note · 🧹 Bloat · ❓ Missing | Fixed set. Order matters.    |

---

## 5 · Section ↔ sidebar mapping

The canvas has 4 product sections. The **Sidebar active state must reflect which section the user is in**, regardless of which agent they're chatting with:

| Section in canvas | Sidebar active value                | Notes                                |
|-------------------|-------------------------------------|--------------------------------------|
| 1 Onboarding      | `SidebarCollapsed active="team" subActive="pm"` (1.2, 1.3) <br> Full `Sidebar` on 1.1, 1.4 | PM lives in Team. |
| 2 Team            | `active="team:<role>"` for worker pages; `SidebarCollapsed active="team"` for Recruit | |
| 3 Missions        | **All PM and worker screens** in this section use `active="mission:<id>"` | Even PM Chat / Brief / Plan — because the user navigated _into_ a mission. PM ≠ Team-active in this context. |
| 4 Skills          | `active="skills"` (use `Sidebar_Skills` if it grows complex) | |

If you find yourself reaching for `active="pm"` outside section 1, you've miscategorized — re-check which section the screen lives in.

---

## 6 · State machine (visual states only)

| Mission state | Where shown                       | Visual treatment                                        |
|---------------|-----------------------------------|---------------------------------------------------------|
| `idle`        | Sidebar mission row dimmed        | `ink-3` text                                            |
| `briefing`    | PM Chat with active draft         | PM panel; banner absent                                 |
| `planning`    | PM panel with Mission Plan inline | PM doc card + sticky comments gutter + Dispatch button  |
| `running`     | Mission Dashboard 2×2             | `approve-soft` mission banner; workers show `● running` |
| `reviewing`   | Reviewer page                     | `review`-themed; **sequential per branch, not parallel**|
| `archived`    | Sidebar grays; PM speaks first    | Workers fade to `ink-3`; PM re-engages                  |

Reviewer specifically: **one branch at a time.** Single active branch shows progress; the rest queue (`○ next`, `◌ queued`). Wireframe 3.4 is the source.

---

## 7 · Implementation order

Don't refactor everything at once. Land in this order:

1. **Tokens.** Drop the CSS variables from §1 into `src/index.css`. Wire Tailwind theme to use them (see appendix). One PR.
2. **Sweep colors.** Grep every literal hex / rgb() in `src/`; replace with token classes. Acceptance: `grep -r '#[0-9a-fA-F]\{3,6\}' src/` returns only the explicit allowlist (scrim, box-shadow).
3. **Shell.** Build `TopBar`, `Sidebar`, `SidebarCollapsed`, `BottomBar`, `MissionRail`, `PMShell` to match §3. Each is its own file.
4. **Card primitives.** `HitlCard`, `WorkerTile`, `Sticky`, `BranchChip`, `Composer`. Each is its own file.
5. **Wire screens.** For each canvas artboard in `Agent Company Wireframes.html`, build the matching React route/screen using §3 components.
6. **Iterate copy + content** with Linzhi.

---

## 8 · Don't

- ❌ Don't introduce new colors. If a screen seems to need one, flag it; the answer is almost always "use a role token you haven't mapped yet."
- ❌ Don't add emoji into UI strings outside the **fixed reviewer set** (🐛 ℹ 🧹 ❓) and the **mission rail folder icon** (📁). Everything else is line-art SVG.
- ❌ Don't introduce drop shadows on cards. Borders only.
- ❌ Don't fork the Sidebar per-screen. Use `Sidebar` or `SidebarCollapsed` with the right `active` value.
- ❌ Don't show all 4 PM tabs on screens where the user hasn't created any docs yet (onboarding 1.2–1.4, fresh PM Chat 3.1). Use `<PMShell hideDocs>`.
- ❌ Don't render the reviewer as 4 parallel progress bars. Sequential only.
- ❌ Don't write PM dialog without HITL on tool calls. Every read_file / write_file / run_shell must surface a `HitlCard`.

---

## 9 · Appendix · Tailwind config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        paper:   'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          soft: 'var(--rule-soft)',
          dashed: 'var(--rule-dashed)',
        },
        pm:      { DEFAULT: 'var(--pm)',      soft: 'var(--pm-soft)' },
        worker:  { DEFAULT: 'var(--worker)',  soft: 'var(--worker-soft)' },
        review:  { DEFAULT: 'var(--review)',  soft: 'var(--review-soft)' },
        approve: { DEFAULT: 'var(--approve)', soft: 'var(--approve-soft)' },
        warn:    'var(--warn)',
        highlight: 'var(--highlight)',
        comment:   'var(--comment)',
        w1: 'var(--w1)', w2: 'var(--w2)', w3: 'var(--w3)', w4: 'var(--w4)',
      },
      borderRadius: {
        card: '4px',
        soft: '6px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        hand: ['Caveat', 'Patrick Hand', 'cursive'],
      },
    },
  },
};
```

---

## 10 · How to ask for clarification

If anything in the wireframes contradicts this document, **the wireframes win** — flag it and Linzhi will update this doc. If a screen needs a primitive that's not listed in §3, **stop and ask** before inventing one. The whole point of locking the system down is to make new screens trivial; if you're inventing components, the system isn't covering enough.
