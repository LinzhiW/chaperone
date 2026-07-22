# Canopy — MVP (PRD + MVP Map)

> The "where's the finish line and what's in scope" source of truth. Pairs with
> `PROGRESS.md` (where are we) and `ACCEPTANCE.md` (can we call it done).
> Operating model for the PM: `PM_OPERATING_MODEL.md`.

## What Canopy is (MVP)

A provider-agnostic, GUI-first multi-agent orchestration platform for non-technical
builders. The human is the **CEO**; the lead agent is the **PM**, who plans and
coordinates **Workers** (each on its own git branch) and a **Reviewer**. Control is
checkpoint-gated; only the CEO accepts work.

## MVP Goal

The CEO briefs a goal → the PM produces a real plan → Workers do the work on branches
under bounded autonomy → the CEO reviews and merges. The org chart is the product.

## MVP Required Slices (the core loop)

The Golden Path is **serial** — these share the same foundation, so they are not
parallel-safe early (see `PM_OPERATING_MODEL.md` §4).

| Slice | CEO action | Delivers | Status |
|-------|-----------|----------|--------|
| **S1 PM produces a real plan** | type a goal | PM reads the real project → Parallelization Plan (golden path, foundation files, gear, L1 audit allocation), persisted | **active** |
| S2 PM dispatches read-only L1 audits | approve plan | PM fans out read-only auditors, fans in findings, consolidates | pending |
| S3 Worker edits a real file on a branch | approve a task | a Worker actually changes a real file on its own branch | pending |
| S4 Checkpoint + Reviewer + merge | review & accept | diff + plain-language review → CEO accepts → merge | pending |

## Iterations / Advanced Slices (post-MVP)

These are **not** MVP-required — the MVP Completion Gate stays at S1–S4. They are the
planned roadmap after the core loop is accepted, ordered by value + dependency. Numbers
continue the sequence; each is a real vertical slice (UI + backend + acceptance), not a
vague theme. Gear rises only as the foundation stabilizes (see `PM_OPERATING_MODEL.md` §4).

| Slice | CEO action | Delivers | Depends on / gear | Already in repo |
|-------|-----------|----------|-------------------|-----------------|
| **S5 L2 layered parallel** ✅ai_verified | approve a plan that splits one slice by layer | PM runs **multiple Workers on ONE active slice** (UI / persistence / tests), with PM-locked interface contracts + file ownership; no cross-worker conflicts | S1–S4 accepted; foundation stable enough to write contracts → **L2** | `/api/pm/l2-plan` (agentic layered split + contracts) + deterministic overlap gate; "Plan L2 parallel work" preset. LIVE-verified |
| **S6 L3 multi-worktree parallel** 🟡backend-primitive | approve multi-slice parallel | Independent slices run in **separate git worktrees/branches** at once; PM integrates + runs full verification | S5 proven; last 2–3 accepted slices didn't touch Foundation Files → **L3**; **CEO explicit confirm** | `POST/GET /api/worktree` + `/api/worktree/remove` (create/list/remove, verified). Auto-dispatch into worktrees still needs CEO confirm — not built |
| **S7 Multi-provider selection** ✅ai_verified | pick the engine | CEO switches **Claude / GPT / Gemini**; BYO-key; unavailable engines greyed | provider adapters already exist | `GET/POST /api/provider` runtime override + Settings selector. LIVE-verified (switch gpt-4o↔gemini; no-key rejected). Per-*worker* routing still future |
| **S8 Skill loadout UX** 🟢backend-ready | equip an agent with skills | Game-inventory-style **skill loadouts** attached to Workers, injected into their system prompt | S7 or standalone | **Backend done + verified**: `/api/skills` (47), saved-sets CRUD, and execute-mission already injects skill content by name. **Only the equip UX remains** |
| **S9 Recruit flow** 🟢backend-ready | create a named Worker | Configure **named Workers** (role, dept, branch prefix, default loadout) that persist to the team | S8 (loadouts) | **Backend done + verified**: `/api/team` CRUD + 6 role-presets; `RecruitModal` exists. **Only recruit→dispatch wiring (UI)** remains |
| **S10 PWA packaging** ⚪frontend-only | install to device | Installable **PWA** for real-device testing + product feel | golden path stable | No backend to prepare (manifest + service worker are frontend build config). Needs device to verify |
| **S11 Billing / subscription** 🔴CEO-decision | subscribe | Flat **subscription on the orchestration layer** (BYO-key, no token metering — see `DECISIONS.md`) | product-ready | Blocked on CEO: pricing + payment provider choice. Not started |

Sequencing note: **S5 (L2 parallel) is the highest-value next step** — it's the first time
Canopy does what a single agent can't, and it's the core differentiator. S7–S9 lean on code
that already half-exists, so they're cheaper than they look.

## Foundation Files (Canopy's own — see PROGRESS.md for the live manifest)
`src/App.tsx`, `server/src/index.ts`, `server/src/persistence.ts`,
`server/src/providers/*`. These are still changing → volatility **High** → we stay at
**Level 1 / single active slice**.

## MVP Completion Gate
All four required slices reach `accepted` (CEO click-tested in the running app, per
`ACCEPTANCE.md`), with behavior-level verification (real files / real diffs / persist
across reload) — not "a card appeared."
