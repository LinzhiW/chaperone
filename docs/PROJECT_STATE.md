# Project State — Agent Company

**Last updated:** 2026-06-09
**Branch:** `feat/t1-structured-tasks` (M0+M1 + all v2 planning docs **uncommitted**)
**Authoritative docs:** [PRD.md](PRD.md) (v2.1) · [TODO.md](TODO.md) (phased backlog)

> **2026-06-09 — major direction reset.** The project pivoted from a Gemini-only
> hand-built engine to a **provider-agnostic, GUI-first, human-coordinated**
> multi-agent platform. This file now reflects that. Older docs (DEV_PLAN, PLAN_v2,
> the pre-pivot sections here) are superseded — see banners in those files.

---

## What the product is now (one paragraph)

A **provider-agnostic, GUI-first multi-agent orchestration platform** for
non-technical users. **One pipeline** (ours) owns all agent behavior — tool loop,
HITL, skill loadouts, git isolation, reviewer. AI vendors (Claude/GPT/Gemini/
DeepSeek) plug in only as **interchangeable model backends** via a thin adapter.
The **human coordinates** (PM/CEO + dashboard); control is **checkpoint-gated**
(bounded autonomy + hard stop at task boundary + human-gated merge), never silent
background token burn.

## Locked architecture decisions (see PRD)
- **One pipeline + thin model adapters** — Claude is *just a model* (Anthropic
  Messages API, **not** the Agent SDK). Adding a vendor = one ~30–50 line adapter.
- **HITL = checkpoint-gated autonomy** (PRD §4), with **per-worker mode** (default Auto).
- **Two coordination layers**: communication (fan-out/fan-in) + integration (git);
  both coexist. Git is load-bearing; no-git → auto-`git init` or single-worker mode.
- **Skill loadouts** (PRD §7.2 + §7.2.2) = the core differentiator. Three-tier
  authority (human > PM-suggest > system base), base set + ~8–10 custom slots,
  one neutral `SKILL.md` injected uniformly (no per-engine translation).

---

## Global "designed vs built" gap (2026-06-09 audit)

Design lives in `.design/agent-company/project/wf-*.jsx` (17 screens). Build is in
`src/App.tsx` (2758 lines) + `server/src/index.ts` (499 lines, Gemini).

| Module | Designed | Built (App.tsx) | Backend |
|--------|:--:|:--:|:--:|
| Onboarding (Welcome / PM scan / Ready) | ✓ | ✅ M0/M1 | `/init-project` |
| PM chat + shell | ✓ | ✅ | `/ceo/chat` |
| PM mission plan (dispatch cards) | ✓ | ✅ | TASK_PLAN |
| PM brief clarify (chips, screen 17) | ✓ | ❌ | — |
| PM docs tabs (PRD / SOP / Dev log) | ✓ | ✅ | — |
| Mission dashboard (worker tiles) | ✓ | ✅ | `/execute-mission` SSE |
| Mission done / archived | ✓ | ⚠️ partial | — |
| Reviewer (diff + annotations) | ✓ | ✅ | `/reviewer` `/create-pr` |
| Worker deep-dive | ✓ | ✅ | `/nudge` |
| HITL reject / rewrite (screen 15) | ✓ | ⚠️ approve/reject only | `/approve-action` |
| Recruit worker (role presets + loadout, 14) | ✓ | ❌ | — |
| **Skills · Library (11)** | ✓ | ❌ | `/skills` (list only) |
| **Skills · Import (12)** | ✓ | ❌ (paste only) | `/add-skill` |
| **Skills · Loadout (13a)** | ✓ | ❌ | — |
| **Skills · Compose Set (13b)** | ✓ | ❌ | — |

**Biggest gap = the entire Skills system (4 screens) + Recruit + PM clarify** —
designed in full, barely built. Skills is the core differentiator, so it's the
priority once the backend refactor lands.

## Backend reality (what's wired)
`server/src/index.ts` is a Gemini-only engine: `/execute-mission` (tool loop +
**per-tool** HITL — to be changed to checkpoint model, TODO P2.5), `/ceo/chat`,
`/reviewer`, `/branch-status`, `/nudge`, `/init-project`, `/add-skill`, `/create-pr`.

## Ports / env
- Frontend (Vite): **http://localhost:5173** · Backend (Express): **http://localhost:3005**
- `GEMINI_API_KEY` required; `GEMINI_MODEL` default `gemini-2.5-flash`
- (Earlier 5174/5175 notes were stale — 5173 is correct.)

## Next steps (from TODO.md)
1. **P0** — commit M0+M1 + these v2 docs (this is the archive point).
2. **P1** — `ModelProvider` interface; extract Gemini into an adapter (foundation, blocks all).
3. Then parallel: **P2** Claude adapter · **P2.5** checkpoint HITL · **P2.6** git policy
   · **P3** engine select · **P4** skill loadouts (core).
4. **P6** UI alignment after backend settles — build the Skills system + Recruit + clarify screens.

## Small open content decision
- Which skills make up the always-on **system base set** (e.g. conventional-commits)? Curate at build time.
