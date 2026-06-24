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

## Not in MVP (later iterations)
Skill-loadout full UX, multi-provider selection UI, recruit flow, L3 multi-worktree
parallel, PWA packaging, billing.

## Foundation Files (Canopy's own — see PROGRESS.md for the live manifest)
`src/App.tsx`, `server/src/index.ts`, `server/src/persistence.ts`,
`server/src/providers/*`. These are still changing → volatility **High** → we stay at
**Level 1 / single active slice**.

## MVP Completion Gate
All four required slices reach `accepted` (CEO click-tested in the running app, per
`ACCEPTANCE.md`), with behavior-level verification (real files / real diffs / persist
across reload) — not "a card appeared."
