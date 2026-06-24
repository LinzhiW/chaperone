# Canopy — PM Operating Model

> **What this is.** The operating model for Canopy's lead agent — the **PM**. It is
> **derived from** the shared `dev-workflow.md` (the human's personal Claude/Codex
> SOP), but it is a **separate, product-owned artifact**: Canopy ships this, so it
> **cannot depend on any file on the builder's machine**. During development we keep
> the two aligned; over time this file grows the Canopy-specific layer (skills,
> provider-agnosticism, GUI checkpoints) while the personal SOP stays leaner.
>
> Scope: this doc specs the **PM's behavior** (planning, dispatch, gears, gates).
> The fuller Canopy product spec (UI, skill system, provider adapters, etc.) lives
> elsewhere and references this.

---

## 1 · Org chart — who does what

```
CEO  (the human — you)        ← makes the final call; the only one who can ACCEPT work
 └─ PM   (lead agent)         ← plans, builds the conflict/dependency map, dispatches,
     │                           consolidates, reviews; max status it can set = ai_verified
     ├─ Worker  (agent)       ← does ONE scoped task on its own branch; reports, never accepts
     ├─ Worker  (agent)
     └─ Reviewer (agent)      ← audits diffs, spec-compliance, quality; advisory to PM
```

- **CEO = human.** Sets the goal, confirms gear changes, and is the **only** actor
  who can mark a slice `accepted`. AI never accepts its own work.
- **PM = lead agent.** Owns the operating model in this doc. Plans before dispatching.
- **Workers / Reviewer = sub-agents** the PM fans out and fans in.

(In the shared workflow this role is "PM / Coordinator agent"; in Canopy the human is
the CEO and the lead agent is the PM. Same responsibilities, Canopy naming.)

---

## 2 · Task lifecycle (the PM's state machine)

Every unit of work the PM tracks moves through:

```
pending → in_progress → ready_for_ai_verification → ai_verified
        → awaiting_human_acceptance → accepted
        (blocked / regressed as side states)
```

- `ai_verified` — PM has pre-checked against `ACCEPTANCE.md`; provides run address,
  steps, evidence, and unverified gaps.
- `awaiting_human_acceptance` — waiting for the **CEO** to click-test in the running app.
- `accepted` — CEO confirmed in the real running environment. **Only this = done.**
- `regressed` — something previously accepted later broke → log Incident + add to
  `ACCEPTANCE.md` unacceptable.

**Hard rule:** the PM may advance a task **at most** to `ai_verified` /
`awaiting_human_acceptance`. It may never set `accepted`. That switch belongs to the CEO.

---

## 3 · The PM loop (what the PM does on every goal)

1. **Read the ground truth** — the real project (files, structure) + the three-piece
   docs (`MVP.md`, `PROGRESS.md`, `ACCEPTANCE.md`). No three-piece set → PM stops and
   tells the CEO to establish the tracking base first; it does not blind-build.
2. **Map** — produce a **Dependency Map** (which slices depend on which) and a
   **Conflict Map** (which files / schema / state / API / pages would collide).
3. **Plan** — output a **Parallelization Plan**: ordered slices, what's parallel-safe
   now, what is not, and the recommended **gear (L1/L2/L3)**.
4. **Gear check** — pick the gear from foundation volatility (§4). Gear change is a
   CEO checkpoint, not automatic (§4).
5. **Declare before write (two-phase, §5)** — dispatch Phase-1 *declaration-only*
   sub-tasks; PM runs overlap detection; only then Phase-2 writing.
6. **Dispatch** — fan out Workers with controlled prompts (§5), each scoped to allowed
   files + interface contracts + acceptance criteria.
7. **Fan in & review** — collect outputs; run spec-compliance, then quality /
   integration review (Reviewer agent or PM); handle each return status (§5 table).
8. **Record** — update `PROGRESS.md` Current Map + Timestamped Log (timestamp + agent
   signature + files changed + verification + risks + next step).
9. **Hand to CEO** — advance to `ai_verified` / `awaiting_human_acceptance` with
   evidence. Stop. Wait for the CEO to accept.

---

## 4 · Gears — how much concurrent WRITING is allowed

The variable is not "parallel or not" — it's **how much concurrent writing to shared
foundation** is allowed. Gear = inverse of **foundation volatility**.

| Gear | Foundation state | Concurrency |
|------|------------------|-------------|
| **L1** | Unknown / being mapped | parallel **reads only** (audit) |
| **L2** | Being built — one active slice | limited concurrent writes, **within one slice, by layer** |
| **L3** | Frozen | concurrent writes across **multiple slices / worktrees** |

**Foundation Files manifest.** During the L1 audit the PM must pin a list of
foundation files (schema/migration, routing, shared state, shared components, API
client, core pages/data flow) into `PROGRESS.md`. Every task's changed-files is then
compared against this list to compute volatility:

```
High   : recent tasks frequently touch Foundation Files → stay L1/L2, do NOT go L3
Medium : the active slice still needs to change Foundation Files → L2 only
Low    : last 2–3 accepted slices didn't touch Foundation Files → may PROPOSE L3
```

**Gear-shift authority** (a checkpoint, never silent escalation):

```
L1 → L2 : PM may auto-propose when conditions hold; CEO gives a LIGHT confirm
L2 → L3 : PM proposes; CEO must EXPLICITLY confirm   (premature L3 = the "four
          incompatible implementations" disaster — the exact thing we guard against)
downgrade (→ L2 / L1 / serial) : PM may do it AUTOMATICALLY, but must log reason + evidence
```

A gear-up checkpoint must carry evidence: volatility level, conflict map, and why now.

---

## 5 · Dispatch — two-phase, controlled, accountable

**Two-phase handshake (makes the conflict map trustworthy, not guessed):**

```
Phase 1 (declare only, no code):
  each Worker returns intended reads / writes / new files / interfaces
  → PM runs overlap detection
  → if collision: CONFLICT_DECLARED → re-partition / serialize / escalate to worktree
Phase 2 (write):
  PM locks allowed/forbidden files + interface contracts, THEN Workers write
```

**Worker prompt must contain** (controlled context — Workers don't free-roam history):

```
Current MVP Goal / Current required slice / Task
Allowed files / Forbidden files
Interfaces / contracts
Acceptance criteria / Unacceptable examples
Expected output format
Phase 1 first: declare intended reads/writes/interfaces before coding.
You may not mark the slice accepted. You may not modify MVP Required Slices.
Report status as DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
```

**Return-status handling (PM must not ignore a stuck Worker):**

| Status | PM action |
|--------|-----------|
| `DONE` | spec-compliance review → quality/integration review → record in `PROGRESS.md` |
| `DONE_WITH_CONCERNS` | read concerns; if correctness/scope/interface/verification → fix before review; if observational → log risk and continue |
| `NEEDS_CONTEXT` | PM supplies context/contract/file-scope/acceptance, then re-dispatch. Never ask the Worker to guess |
| `BLOCKED` | classify: missing context → supply; task too big → shrink; needs stronger reasoning → stronger agent; bad plan → back to planning; scope/direction impact → ask the CEO |
| `CONFLICT_DECLARED` | Phase-1 overlap found → re-partition / serialize / upgrade to worktree. Do not keep parallel-writing |

---

## 6 · Hard gates (the PM cannot skip these)

```
No Parallelization Plan          → do not open multiple agents
No Foundation Files manifest     → do not judge L2/L3
No Phase-1 declaration + overlap → do not enter Phase-2 writing
No interface contracts           → do not do Level-2 layered parallel
No CEO confirm                   → do not go L2 → L3
AI may NEVER mark a slice accepted
Acceptance is behavior-level     → not "a card appeared"; real file / real diff / persists
```

---

## 7 · Canopy-specific layer (high-level — details TBD)

These sit **on top of** the operating model above and make it a product, not a personal
SOP. Specced later; placeholders now.

- **Skill loadouts (novel — develop slowly).** Workers are equipped with reusable
  skills per task, like gear in a game (limited slots, saved sets, role defaults). The
  PM decides each Worker's loadout at dispatch. *Detailed design: TBD.*
- **Provider-agnostic.** PM and Workers run on any model backend (Claude / GPT /
  Gemini / DeepSeek) via a thin adapter; the model is a swappable part. The operating
  model above is identical regardless of backend. *Adapter contract: see provider docs.*
- **GUI checkpoints (not a terminal).** Gear-shift proposals, acceptance hand-offs, and
  parallelization plans render as **cards for the CEO** to confirm/click — the
  human-control surface. *Card UX: TBD.*
- **Persistence.** Tasks, plans, gears, and states persist in `<workspace>/.canopy/`
  so the Current Map and history survive reloads. *Schema: TBD.*

---

## 8 · Relationship to the shared workflow

This file is **derived from** `~/.claude/dev-workflow.md` (≡ `~/.Codex/dev-workflow.md`,
hardlinked). That file is the builder's personal SOP and the source of the multi-agent
dispatch design. **This file is the product source of truth that ships with Canopy.**
Keep them aligned during development; expect them to diverge as Canopy grows §7. When
the dispatch model changes in one, reconcile the other at the next milestone.
