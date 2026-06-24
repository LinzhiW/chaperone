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
