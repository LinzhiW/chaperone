# UI audit — what looks built but isn't

**Swept:** 2026-09-06, against `src/App.tsx` at commit `f510f27`.

## Why this exists

Chaperone's screens were ported from wireframes one-to-one. That produced a UI
that reads as finished while parts of it are still a picture of a feature. Four
separate times a control turned out to do nothing only because someone clicked
it, so this is the result of looking for the rest deliberately rather than
waiting to trip over them.

The method was mechanical, not by eye: find every `<button>` and every element
styled `cursor: pointer` whose tag carries no handler, then read each hit in
context. Re-run it after any wireframe port:

```bash
grep -n "NOT_WIRED" src/App.tsx        # what is already known and marked
```

## What was found

Everything below is now marked in the UI — greyed, `cursor: not-allowed`, and a
"Not built yet" tooltip — rather than deleted, so the design intent stays
visible and nobody trusts a control that cannot deliver. They are marked with
the `NOT_WIRED` constant, which is the way to find them in code.

### Controls with no behaviour

| Control | Where | Notes |
| --- | --- | --- |
| **⏸ Pause** | Worker deep-dive | The brake. A product whose pitch is stopping AI from doing the wrong thing must not show a stop button that does nothing — fix first. |
| **Pause mission** | Mission header | Same, at mission level. |
| view branch diff | Worker tile | `/api/diff` already works and the Reviewer already calls it — this is a wiring job, not a feature. |
| view chat history | Worker tile | Needs a store of per-worker transcripts; none exists yet. |
| edit loadout ↗ | Worker deep-dive | The Skills loadout editor exists (`src/skills/WorkerLoadout.tsx`); needs routing. |
| ＋ skill | Assignment card | Same component could serve it. |
| Keep refining | PM plan screen | Should send the plan back to the PM for another pass. |
| Send all to PM → revise plan | Reviewer gutter | The whole review-comments feature is unbuilt (see below). |

### Fake data

- **"0 open comments"** in the Reviewer gutter was a hardcoded string, not a
  count. Replaced with a plain, visibly-inactive "Comments" heading. The comment
  feature has no backend, no state, and no way to add one — the "select text to
  add a comment" hint below it is also aspirational.

A later sweep specifically for invented numbers found five more. All are gone; the
rule now is that a figure shown to the user is one the app actually measured, and
anything else shows nothing rather than something plausible.

| Was | Where | What it really was |
| --- | --- | --- |
| `✓ tests pass · coverage 75–94%` | Worker tile, done state | `75 + (assignment.id % 20)`. Nothing runs tests. It always said they passed. |
| `N commits · M files` | Worker tile, done state | Real `git` numbers when available; otherwise log-line count **plus 3** and **plus 4**. Now says "branch stats not read yet". |
| Per-branch ✓ / … ticks | Reviewer, per-branch review | `i < 2 ? 'approved' : i === 2 ? 'waiting' : 'approved'` — approval read off the array index. Now reads `mission.mergedBranches`. |
| `Review PRD edits (3)` + `SOP unchanged` | Archive footer in PM chat | Both literals. Nothing counts doc edits or compares the SOP. Now one `Open PRD →` button. |
| The archive footer itself | PM chat | Shown on any PM message containing the text `Dev log.md`, so the PM merely *naming* that file grew a report of work that never happened — while the real archive notice, which does not contain that string, never matched. Now a `kind: 'archive'` flag set where the archive actually happens. |

- `PMTab_PRD` and `PMTab_SOP` are deleted. Neither had a render site, and both
  carried invented content — a PRD review over a fixed edit list, and an SOP
  asserting rules nothing enforces ("Coverage minimum: 80% on touched files").

### Dead code (never rendered — no user impact)

- `PMTab_PRD` and `PMTab_SOP` were listed here as safe to delete. They have been
  deleted; see the fake-data table above for why they were more than dead weight.

## Already fixed, for the record

Not open items — listed so a later sweep doesn't re-report them.

- Onboarding **scan** screen printed tool calls the model never made and a
  conclusion about files it never checked. Now calls `/api/pm/explore`.
- Onboarding **docs** screen let you approve drafts that did not exist, while
  `/api/init-project` wrote unrelated placeholders. Now calls
  `/api/pm/draft-docs`; approving writes exactly what is shown.
- `window.prompt` / `window.confirm` in all four project-entry paths — unavailable
  in embedded contexts, so the app could not be entered at all. Replaced with an
  in-app modal.
- The gear and ＋ in `EmptyMissionRail` had tooltips promising actions and no
  handlers, leaving a first-run user unable to reach Settings — and so unable to
  enter any key but Gemini's.
- The Settings modal rendered only after the onboarding early-returns, so the
  gear did nothing until a project was open.
- Files sidebar showed one flat `readdir` with no git status. Now a real tree.
- The **setup screens rendered a second, dead copy of the sidebar**
  (`Sidebar_Empty`). Files, Team, Missions and Skills carried no handler at all,
  so during setup the whole left nav was a picture — which is what a user hits
  first. Reopening a saved project has always skipped setup, so leaving it early
  was already allowed; there was just no way to say so. Each row now leaves setup
  and opens that view. The three ＋ buttons work from there too: Team's opens
  Recruit, Skills' opens Add Skill, Missions' puts the cursor in the PM composer.
  Both modals live below the setup early-returns, so they can only open once the
  app proper is rendering — hence leaving setup first, not instead.
- **Team and Missions could not be collapsed** in the real sidebar either — only
  Files could, so clicking the other two headers did nothing. All three toggle
  now. Files' own arrow was hardcoded to ▸ and never moved.
- **`＋` on Missions did nothing visible.** It called `setActiveView('pm')` while
  you were already on the PM screen. No button makes a mission — the PM proposes
  one and you dispatch it — so it now puts the cursor in the PM composer, and an
  empty mission list says "＋ brief the PM" rather than sitting blank.

## Found later, in the same spirit

- **The mission plan and brief screens are unreachable.** `pmScreen` has three
  states — `idle`, `briefing`, `plan` — and nothing in the app ever sets
  `briefing`, while the only route to `plan` is a button inside `briefing`. Both
  screens render fine if you force the state; a user cannot get to either. The
  plan screen's three workers ("W1 ui-worker / feat/ui-layer …") are a hardcoded
  fictional feature, and its Dispatch button reads the real, empty
  `pendingAssignments` — so it would do nothing even if reached.
- **Corrected from the sweep above:** the Skills library and Recruit flow were
  listed in older docs as unbuilt. They are built and reading real data — the
  library lists the skills in the user's own skills directory, and recruiting is a
  working three-step flow. Trust the app over `docs/BUILD_TRACKER.md` here.

## Suggested order

1. **The two Pause controls.** Not because they are hardest, but because a brake
   that does not brake is the worst thing on this list to leave marked.
2. **view branch diff.** The backend is already there.
3. **edit loadout / ＋ skill.** One editor, two entry points.
4. **Keep refining.** Needs a PM round-trip on an existing plan.
5. **Review comments.** The largest — no backend at all yet. Worth deciding
   whether it belongs in the MVP before building it.
