# Product Requirements Document (PRD) — Chaperone

> **v2 · 2026-06-09** — Major direction update. Supersedes the v1 single-stack
> (Gemini-only) PRD. See `docs/CHANGELOG.md` for the rationale and migration notes.
> **v2.1 · 2026-06-09** — Corrected the HITL model (checkpoint-gated autonomy, not
> per-tool approval) and the provider model (one pipeline + thin model adapters;
> the platform owns agent behavior — vendors are interchangeable model backends).

## 1. Product Vision

A **provider-agnostic, GUI-first multi-agent orchestration platform** that lets
**non-technical users** run a coordinated team of AI coding agents on their own
machine — with **checkpoint-gated human control** and **git branch isolation**
for safety, and **never any silent background token burn**.

Chaperone is **one architecture / one pipeline**. The orchestration, the
human-control model, skill routing, and git isolation are all built by us and are
**vendor-independent**. Different AI vendors plug in only as **interchangeable
model backends** — Claude, GPT, Gemini, DeepSeek, or a local model — through a
thin adapter. The platform never depends on any single vendor's agent engine.

**One-line positioning:** *"The cockpit for your AI dev team — bring your own
model, we own the orchestration, the safety, and the skills."*

## 2. Why this pivot (context for future readers)

The v1 backend (`server/src/index.ts`, ~499 lines) hand-built an agent execution
pipeline on top of Gemini: a tool-calling loop, human approval, git branch
checkout, skill injection, a reviewer, and PR creation. Seeing Claude Code do all
of this natively first read like "we rebuilt something that already exists."

**The real lesson is the opposite of 'just use Claude.'** Claude *validated* that
the orchestration pattern works — but wrapping any single vendor's agent would
lock us in and isn't the product. The product is **our own vendor-neutral
pipeline**, where every vendor is just a model. So we **keep** the hand-rolled
pipeline (it's the right call), **generalize** its model-call layer behind a thin
interface, and let Claude/GPT/Gemini/DeepSeek all plug in as model backends.

The defensible work is **not** the execution engine. It is:

1. **Lowering the barrier** — a GUI that lets non-technical users drive
   multi-agent orchestration they could never run from a CLI.
2. **Solving skill discovery/routing** — today skills sit in files that agents
   don't know how to find or invoke, and role-specific agents have no way to pick
   the right skill. We make skill→role assignment **visible and automatic**.
3. **Provider independence** — one pipeline over any model the user already has.
4. **A control model people actually trust** — bounded autonomy with hard
   checkpoints, so nothing runs invisibly (the Paperclip failure mode).

## 3. Core differentiators (the "看点")

| # | Differentiator | Why it's hard to copy |
|---|----------------|------------------------|
| D1 | **One pipeline, any model** | The platform owns agent behavior; vendors are swappable model backends (LiteLLM/OpenRouter-style, but for full agent orchestration) |
| D2 | **Skill loadouts (human-equipped, drag-drop)** | Humans arm each agent like a game loadout — modular, visible, deliberate; auto-suggestion is an optional assist, not a hidden auto-load. One skill model, injected uniformly across vendors |
| D3 | **Checkpoint-gated HITL for non-tech users** | Bounded autonomy + mandatory review gates + visual merge — trust without per-step babysitting |

## 4. The human-control model (HITL) — **core, and corrected from v1**

v1 paused for approval on **every tool call**. That is **not** the model. The
model is **bounded autonomy with hard checkpoints**:

1. **Task handoff** — human gives a worker one assignment.
2. **Autonomous execution** — the worker acquires the tools/permissions it needs
   **on its own** during the task. Routine actions are auto-approved.
3. **Sensitive-action gate (rare)** — only actions classified as
   important/irreversible (e.g. force-push, delete, secrets, network spend,
   destructive shell) pause for explicit human approval. This list is a
   **configurable policy/allowlist**, not every call.
4. **Hard stop at task boundary** — when the assignment finishes the worker
   **stops and waits**. No auto-merge, no auto-next-step.
5. **Human review gate** — the human inspects the result (branch diff, logs, cost).
6. **Human-gated merge** — on approval, the work merges up to the PM/CEO.
7. **Replan** — PM/CEO incorporates the result and plans the next step. Loop.

**Anti-Paperclip invariant:** the system always halts at a visible gate; it never
spends tokens or acts in the background without the human knowing what happened.
Token/cost is shown per task and bounded by the stop-at-boundary rule.

**Per-worker autonomy mode (borrowed from Claude Code's mode selector).** The
autonomy level is a **per-agent setting**, defaulting to *Auto*, user-overridable
by habit and by task sensitivity:

| Mode | Worker behavior |
|------|-----------------|
| **Auto** (default) | bounded autonomy: routine auto, only sensitive actions pause |
| **Ask** | cautious: pause on every action (new users / high-risk tasks) |
| **Accept edits** | auto-apply file edits, but ask on shell/network/other |
| **Plan only** | plan, don't execute — ideal for the PM/CEO role or a dry-run |
| **Bypass** | full autonomy (trusted worker / low-risk task) |

*Relation to Claude CLI:* the in-flight half (auto + ask-on-sensitive) overlaps
Claude's permission modes; the productized **multi-worker → review → confirm →
merge → PM-replan** loop is ours. We do not delegate control to any vendor's agent.

## 5. Architecture — one pipeline, thin model adapters

```
                ┌──────────────────────────────────────────┐
   GUI (React)  │  PM panel · Mission dashboard · Skills UI │
                └──────────────────────────────────────────┘
                                  │  (one API surface)
                ┌──────────────────────────────────────────┐
   THE PIPELINE │  PM planning · Mission/Assignment model   │
   (ours, owns  │  tool loop · checkpoint HITL · skill router │  ← vendor-INDEPENDENT
   everything)  │  git branch isolation · reviewer · cost   │
                └──────────────────────────────────────────┘
                                  │  ModelProvider interface (thin)
        ┌───────────────┬─────────┴────────┬────────────────┐
   Gemini adapter   Claude adapter     OpenAI adapter   DeepSeek adapter
   (existing code,  (Anthropic         (OpenAI          (OpenAI-compatible
    extracted)       Messages API)      SDK)             endpoint)
        └────────── each ~30–50 lines: just normalizes the API ──────────┘
```

**Design rules:**
- **The platform owns all agent behavior** — the tool loop, the checkpoint HITL,
  skill routing, git isolation, reviewer, mission model. None of this is per-vendor.
- A **`ModelProvider`** adapter does **one job**: normalize a vendor's
  chat/completion + function-calling API into our common shape (messages in →
  text/tool-calls out, streamed). It does **not** reimplement the agent; it does
  **not** bring the vendor's own tools/skills/permissions.
- **Adding a vendor = adding one small adapter.** The pipeline does not change.
  Vendor differences are purely **model capability** (quality, speed, context, cost).
- **Claude is just a model here** (Anthropic Messages API with tool-use). We
  deliberately do **not** use the Claude Agent SDK / Claude Code's agent loop —
  that would re-introduce vendor lock-in we're avoiding.
- **Engine detection + selection**: on launch, detect what the user has
  (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, local endpoints) and
  let them pick the model — global default, per-mission, or per-worker.

### 5.1 Two coordination layers (they coexist — not either/or)

Multi-agent coordination has **two distinct layers**; the platform owns both:

| Layer | What it does | Mechanism |
|-------|--------------|-----------|
| **Communication** | hand a task to a worker, get its result/status back | fan-out (dispatch) / fan-in (result) — via SSE + result summary. Cheap; keeps the orchestrator's context lean (workers' messy intermediate steps stay isolated and are discarded). |
| **Integration** | isolate parallel file changes, review, revert, merge | **git** — one Assignment = one branch; human reviews the diff, then human-gated merge. |

Communication can't isolate file changes (two workers in one folder still clobber
each other on disk); git can't pass a conversation. **Both are always present.**

### 5.2 Git policy & no-git fallback

git is **load-bearing** for the product's "human reviews then merges" value prop —
it is not optional. The decision tree when starting work:

1. **Repo is git** → use git branch isolation (default path).
2. **Not a git repo** → offer to auto-`git init` (one click, near-zero cost).
3. **User refuses git** → degrade to **single-worker sequential mode** (one worker
   touches files at a time, so there's nothing to collide or merge). No parallel
   file-editing without isolation. We do **not** fall back to per-folder copies.

## 6. Provider support (target)

| Vendor | Adapter mechanism | Phase | Notes |
|--------|-------------------|-------|-------|
| **Gemini** | existing code, extracted into adapter | ✅ have it | reference implementation |
| **Claude** | Anthropic Messages API (tool-use) | P1/P2 | just a model — no Agent SDK |
| **GPT** | OpenAI SDK | P2 | |
| **DeepSeek** | OpenAI-compatible endpoint | P2 | |
| local | OpenAI-compatible (Ollama/LM Studio) | later | offline option |

HITL, skills, tools, review are **provided by the pipeline, identically for every
vendor** — the user's experience does not change when they switch models.

## 7. Other core features (carried from v1, now pipeline-owned)

### 7.1 Mission Control (Dashboard — *not* "Kanban")
- **PM/CEO chat**: orchestrator plans, outputs structured `<<<TASK_PLAN>>>`, never executes.
- **Mission dashboard**: live tiles per worker, SSE streams.
- **Manual Dispatch**: the only path from plan → execution.

### 7.2 Skill loadouts (D2 — core). Four layers; the heart is human-equipping.

Full design spec lives in `.design/agent-company/project/backups/phase2b-13a/wf-skills.jsx`
(screens 11 Library · 12 Import · 13a Worker Loadout · 13b Compose Set).
**Build state: mostly DESIGNED, not built** — see §7.2.1.

1. **Modular skills** — each skill is a self-contained `.md` capability unit with a
   **source provenance** (built-in / yours / **GitHub w/ auto-resync on upstream
   change**), category, and description. The **Library** (screen 11) browses them:
   search, category filters w/ counts, sort (Most used / Newest / By role), "used
   by N workers". **Import** (screen 12): Upload .md / GitHub link / Paste raw.
2. **Human loadout (core)** — the human **equips an agent like a game character**
   (screen 13a):
   - **Slot capacity** — an always-on **base set** (doesn't consume slots) + **~8–10
     custom slots** per agent (see §7.3; supersedes the wireframe's 6). Equipping is a
     *constrained, deliberate* choice, not a dump-everything.
   - **Drag** from Library onto slots · reorder · ✕ to unequip · swap.
   - **Apply a saved set** with a **diff preview** before committing (keep ✓ / add +
     / drop ✕ → Replace or Merge).
   - **Save-gated (HITL for skills)** — edits **do not affect the worker until
     saved**; "changes affect the worker's *next* tool call"; Discard to revert. No
     auto-save. *This is §4's checkpoint philosophy applied to arming.*
   - **Compose a set** (screen 13b) — reusable, not bound to a worker; save target
     Private / Shared / Publish-to-community (future); optionally **seed onto a role
     preset** (default kit for new workers of that role).
3. **Discovery/suggestion (optional assist)** — PM may *suggest* fitting skills per
   assignment by matching `description`→task; equip-immediately-on at import. A
   suggestion the human accepts/edits — **never a hidden auto-load** (consistent §4).
4. **Runtime injection (invisible plumbing)** — equipped skills are injected as
   **system-prompt text, uniformly for every model** (existing `readSkillContent`
   path). One neutral `SKILL.md`; **no per-engine native-skill path, no translation**
   (Claude is just a model). Rides on the §5 model adapter. See §7.3.

**Why it's the moat:** CLIs leave skills either as dead files nobody equips or as
opaque auto-loads the human can't see/control. We make arming an agent a visible,
constrained, human-owned act — an intuitive UX (everyone understands equipping a
character) that also keeps the human in control. Lowers the barrier *and* fits HITL.

#### 7.2.1 Build state (reality, 2026-06-09)
| Piece | Designed (wf-skills.jsx) | Built (App.tsx) |
|-------|:--:|:--:|
| Add-skill modal (name + paste raw → `/api/add-skill`) | ✓ | ✅ built |
| Read-only "Equipped Skills" list on assignment | ✓ | ✅ built (link dead) |
| Skill Library page (search/category/sort/sources) | ✓ | ❌ |
| Worker Loadout editor (slots, drag, save-gate, apply-set preview) | ✓ | ❌ |
| Slot capacity + PM upgrade | ✓ | ❌ |
| Compose a set + role-preset seeding | ✓ | ❌ |
| Import tabs (Upload .md / GitHub auto-resync / paste) | ✓ | ❌ (only paste-raw exists) |
| Skill community | ✓ (future) | ❌ |

#### 7.2.2 Resolved decisions (2026-06-09) — development north star

**Three-tier authority model (G2).** Skills attach in three tiers, by who controls them:

| Tier | Source | Authority |
|------|--------|-----------|
| **Base / system default** | system auto-configures foundational skills | always-on baseline |
| **PM suggestion** | PM proposes task-fit skills | **suggest-only** — shown with one-click "accept · mount"; PM cannot force-equip |
| **Human loadout** | human drags / equips / removes | **highest — overrides all** |

Conflict precedence: **Human > PM-suggested > system default.**

**Capacity (G2).** The general library may hold dozens of skills, but a single agent's
loadout stays small and curated: **always-on base set (no slot cost) + ~8–10 custom
slots** per agent for the task. (Supersedes the wireframe's 6.)

**Format & injection (G1).** **One neutral `SKILL.md`** — frontmatter `name`/
`description` (+ optional category/role tags) + markdown body; the same format
`~/.agents/skills` and the **skill-creator skill** already use → adopt that as the
canonical schema. At runtime the body is **injected as system-prompt text, uniformly
for every model**. **No per-engine native-skill path, no skill-specific translation**
(Claude is just a model); it rides on the §5 model adapter. Cost is bounded by loadout
capacity and **shown as an estimated token count per loadout (G4)**.

**Suggestion UX (G3).** PM suggests → human accepts/edits (quick "accept · mount");
never a silent auto-load.

**Mid-mission change (G6).** Editing a *running* worker's loadout is a **sensitive
action → checkpoint gate**; save-gated, takes effect on the worker's next tool call.

### 7.3 Safety & transparency
- Checkpoint-gated HITL (§4). Git branch isolation: one Assignment = one branch.
- Activity logs; per-task cost/usage monitor (per active model).

### 7.4 Reviewer & PR
- Cross-branch review → annotations (bug/note/bloat/missing) → archive to Dev log.
- PR via `gh`. Merge is human-gated (§4 step 6).

## 8. Non-goals
- Not fully-autonomous (checkpoint gates are mandatory; no silent background runs).
- Not locked to a single LLM vendor; not wrapping any vendor's agent engine.
- Not per-call babysitting either — autonomy between gates is the point.

## 9. UI standard
- **Design system**: warm-paper light theme (`.design/CLAUDE_CODE_DESIGN_SYSTEM.md`,
  tokens in `src/index.css`). (v1 "Discord dark / Kanban" is retired.)
- **Layout**: Mission rail · Sidebar (Workspace/Team/Missions/Skills) · main panel.
- **Language**: English UI; bilingual (CN/EN) communication.
- **Sequencing**: backend/architecture first; UI then aligned against real
  functionality (no screen-by-screen alignment ahead of the engine).

## 10. Success metrics
- **No silent execution**: 100% of runs halt at a visible checkpoint; cost shown per task.
- **Sensitive-gate integrity**: 0% of policy-flagged sensitive actions execute without approval.
- **Model portability**: ≥2 models usable end-to-end (Gemini + Claude) through one UI, no UX change on switch.
- **Isolation**: 100% of approved assignments get their own branch; merge is human-gated.
- **Barrier**: a non-technical user runs a 2-worker mission end-to-end without a terminal.

## 11. Open questions
- Exact policy for "sensitive action" classification (default list + user overrides).
- How to display per-model cost when keys/billing differ per vendor.
- Skill-format portability across models (keep SKILL.md as the neutral format).
