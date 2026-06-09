# Agent Company — handoff to Claude Code · Delivery 2 (2026-05-19)

You already have a working codebase at `LinzhiW/agent-company@main` (Vite + React 18 + TS + Tailwind, Gemini 1.5 Pro, Express+SSE backend with HITL, ~530 LOC). **This is NOT a from-scratch handoff.** This is a delta on top of what you've built.

## ⚠ Conflict resolution

设计稿 (this delivery) 比代码 step forward 一点。**冲突时以设计稿为准。** 把代码改过来对齐设计，不是反过来。如果某个改动代价过大，停下来跟 Linzhi 商量，不要自己保留旧实现。

## Read order

1. `DESIGN_LOG.md` — start here. The Delivery log near the top tells you what's new since 2026-05-18.
2. **`DESIGN_LOG.md` §15 — alignment section** — this is the most important part for you. It enumerates every delta between your current code and the new design, with explicit "what to change" guidance.
3. `Agent Company Wireframes.html` — 21 wireframes in 7 user-journey sections. Half-fi visuals, not pixel specs.

## Hard constraints (unchanged from Delivery 1)

- **HITL is non-negotiable.** Every worker tool call requires explicit user approval. Never add a "trust this command" bypass.
- **PM never enters a running mission.** Once user clicks Dispatch, PM exits. PM only re-engages when the user archives a reviewer report.
- **PM never writes code.** PM only maintains markdown (PRD/SOP/Dev log) and plans missions.
- **Coordination via git branches.** Workers don't communicate at runtime.
- **Vocabulary fixed**: Mission / Assignment / Dispatch / Archive. No more "Session" or "Task" in UI.

## Suggested execution order for this delivery

Build in this order. Each phase runnable end-to-end before next.

**Phase 1 · Naming + theme cleanup.** Rename CEO → PM, Session → Mission, Task → Assignment across UI strings. Lift hardcoded `#5865f2`/`#2b2d31` Discord colors into Tailwind theme tokens; design system to be agreed with Linzhi. (Don't pick the final palette yet — just make swapping easy.)

**Phase 2 · Mission state machine.** Extend `EXECUTING` to full lifecycle: `idle → briefing → planning → running → reviewing → archived`. Each state corresponds to a wireframe screen (see §15.7). Sidebar shows the active mission's state.

**Phase 3 · PM Brief + Plan flow** (wireframes 5 + 6). Replace the regex TASK parser with structured function-calling output. Plan draft is a doc-style page with sticky comments in a right gutter; user clicks Dispatch to enter `running` state.

**Phase 4 · Worker chat deep-dive + HITL reject/rewrite** (wireframes 8 + 9). Click a worker tile → full-screen chat. Reject splits into A (rewrite cmd) / B (send feedback, worker re-plans).

**Phase 5 · Mission ending — Done → Reviewer → Archived** (wireframes 10 + 11 + 12). Expand T7's lightweight Reviewer into the full 4-type-annotation cross-branch report. Archive writes to `~/<project>/.agent-company/Dev log.md`.

**Phase 6 · PM memory tabs** (wireframes 13 + 14 + 15). PRD/SOP/Dev log tabs in PM panel, with HITL-diff pattern for PM-proposed edits.

**Phase 7 · Skills system** (wireframes 17 + 18 + 19 + 20). Library, import (.md / GitHub / paste), per-worker loadout (no slot cap), composable saved sets.

**Phase 8 · Recruit worker** (wireframe 16). 3-step modal with 6 engineering role presets.

## Questions you should ask Linzhi before starting

If you've already answered any of these in earlier discussion, skip those — but flag any you haven't:

1. **Theme** — keep Discord-dark? Lighter/warmer alternative? Both? (Affects every screen but is reversible if we abstract well.)
2. **PRD.md / SOP.md / Dev log.md location in user's project** — confirm `~/<project>/.agent-company/`.
3. **Skill files location** — workspace-local `./agent-company/skills/`, user-global `~/.agent-company/skills/`, or both?
4. **LLM** — stay Gemini-only? Add Claude/multi-provider abstraction? (Multi-provider can be Phase N+1.)
5. **Reviewer's 4 annotation types** — categories settled (🐛 Bug / ℹ Note / 🧹 Bloat / ❓ Missing). Confirm names + tone OK before baking into the LLM prompt schema.

## What we are NOT building yet

- Multi-mission concurrency UI (one running mission at a time)
- Non-engineering departments (Design / Marketing) — engineering roles only for now
- Skill community (browse skills from other teams) — Phase 3
- PM Doc auto-generated git-diff mode — Phase 3
- Mobile / responsive layouts — desktop-first

## How to ask

When you hit ambiguity, **stop and ask**. Quote the line from DESIGN_LOG.md or the wireframe screen number so Linzhi can confirm or correct. Don't write 200 lines on a guess.
