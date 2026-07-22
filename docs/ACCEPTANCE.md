# Canopy — Acceptance (验收 SOP + 反例库)

> "Can we call it done" source of truth. The CEO click-tests every slice in the
> running app. AI may pre-check (→ `ai_verified`) but **only the CEO sets `accepted`.**
> Acceptance is **behavior-level**: real file / real data / persists — not "a card showed up."

---

## S1 · PM produces a real plan

Run: frontend `http://localhost:5183` · backend `http://localhost:3005`.
Open the PM tab → the "📋 Parallelization Plan" card.

**Acceptable (CEO clicks):**
- [ ] Type a goal (e.g. "add a project switcher"), press ↵ → a plan card appears.
- [ ] The plan's **Foundation files reference REAL files that exist in this project**
      (e.g. `src/App.tsx`, `server/src/index.ts`) — proving the PM read the real repo,
      not a canned template.
- [ ] **Recommended gear = L1** with a read-only audit allocation (because foundation
      volatility is High on this early project).
- [ ] Change the goal and regenerate → the plan content changes accordingly.
- [ ] **Reload the page → the plan is still there** (loaded from `.canopy/pm-plan.json`).

**Unacceptable:**
- [ ] Card shows fixed/generic content unrelated to this project.
- [ ] References files that do not exist in the tree.
- [ ] Recommends L2/L3 writing on an unstable foundation.
- [ ] Plan disappears on reload.
- [ ] AI claims "done" without a run address + the CEO having clicked the checks above.

---

## S2 · PM dispatches read-only L1 audits

Open the PM tab → click **"Plan agent dispatch"**.

**Acceptable (CEO clicks):**
- [ ] PM decides how many auditors to run (not a fixed 2) and fans them out in parallel.
- [ ] Output is a **dispatch assessment**, not a generic tech audit: it states the current
      **stage**, the **Golden Path + dependencies**, **slice classification**, **Foundation
      Files + volatility**, a **recommended gear (L1/L2/L3) with reasons**, concrete
      auditor allocation, and ends with **one follow-up question**.
- [ ] Foundation files / slice names are **real** (cite files that exist in the repo).
- [ ] Footer shows how many auditors ran and how many files each read.

**Unacceptable:**
- [ ] A worker/branch is dispatched for this (it is read-only — PM's own audit).
- [ ] Generic "Foundation Files / Dependency Map / Current State / Next Focus" with no
      stage judgement, no gear recommendation, no next-step question.
- [ ] Invents files the auditors never read.

---

## S3 · Worker edits a real file on a branch

The first real disk write. Dispatch a code mission → open the mission → start the worker →
approve its `write_file` → **View diff**.

**Acceptable (CEO clicks):**
- [ ] Starting the worker **creates/checks out a git branch** (log shows `[GIT] Created
      branch: …`). *(verified: sandbox creates + checks out `feat/add-line`)*
- [ ] The worker proposes a `write_file`; **nothing is written until the CEO approves**
      (HITL gate via `require_approval` → `/api/approve-action`).
- [ ] After approval, the **real file on disk changes** on the branch.
- [ ] **View diff** shows the real `git diff` of the branch vs base (base auto-detected —
      `main` or `master`). *(verified: `/api/diff` returns the real unified diff)*
- [ ] The base branch (e.g. `master`) is left unchanged until merge.

**Unacceptable:**
- [ ] File is written before the CEO approves.
- [ ] "Diff" is mocked / not the real git diff.
- [ ] Writes land on the base branch instead of the feature branch.
- [ ] AI claims done without the CEO seeing the real diff.

_Status: plumbing (branch + diff + HITL wiring) AI-verified in a sandbox; the
model-driven write step is pending (blocked by a model-API outage at build time)._

---

## S4 · Checkpoint + Reviewer + merge

Open a mission with worker branches → **Call Reviewer** → **View diff** → **Accept & merge**.

**Acceptable (CEO clicks):**
- [ ] Reviewer reads the **real branch diffs** (base auto-detected) and returns annotations.
- [ ] CEO can **View diff** per branch before accepting.
- [ ] **Accept & merge** merges the branch into the base with a real merge commit; the base
      branch now contains the change. *(verified: `/api/merge` produced a `--no-ff` merge;
      `master` gained the worker's line)*
- [ ] On a merge conflict, the merge **aborts cleanly** and reports it (repo left clean).
- [ ] Merged branches show `✓ merged`.

**Unacceptable:**
- [ ] "Merge" reported as done but the base branch didn't change.
- [ ] A conflict leaves the repo mid-merge / dirty.
- [ ] CEO can't see the diff before accepting.

_Status: reviewer + merge plumbing AI-verified in a sandbox; the reviewer's model-driven
annotation step is pending (model-API outage at build time)._
