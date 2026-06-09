# Session Handoff — read this first in a new window

**Snapshot taken:** 2026-06-09 (after the v2 direction reset + skill-loadout spec)
**Branch:** `feat/t1-structured-tasks` — M0+M1 code + all v2 planning docs **uncommitted**

---

## TL;DR — what just happened

This session was **planning/spec, not code**. We reset the product direction and
locked the skill system spec. **Read in this order:**
1. [PRD.md](PRD.md) v2.1 — the spec (provider-agnostic; §4 HITL; §5 architecture;
   §7.2 + §7.2.2 skill loadouts).
2. [TODO.md](TODO.md) — phased backlog P0–P6 with branches + dependency graph.
3. [PROJECT_STATE.md](PROJECT_STATE.md) — current truth + global designed-vs-built gap table.

## The direction (in one breath)
Provider-agnostic, GUI-first, human-coordinated multi-agent platform. **One pipeline**
owns agent behavior; vendors are interchangeable **model backends** (Claude is just a
model — Anthropic Messages API, no Agent SDK). **Checkpoint-gated HITL** (not per-tool).
**Skill loadouts** (equip agents like a game) are the core differentiator.

## Locked decisions this session (don't re-litigate)
- Engine: don't brute-force replace — refactor in place; Gemini code → first adapter.
- HITL: bounded autonomy + hard stop at task boundary + human-gated merge; per-worker mode.
- Coordination: fan-out/fan-in (comms) + git (integration) coexist; git load-bearing.
- Skills (G1–G6 resolved): three-tier authority (human > PM-suggest > system base);
  base set + ~8–10 custom slots; one neutral `SKILL.md` injected uniformly, **no
  per-engine translation**; PM suggest→accept·mount; mid-mission edit = gate; show token cost.

## On resume — next actions
1. **P0**: `git commit` the M0+M1 work + all v2 docs (archive point). ← do this first.
2. **P1** (foundation, blocks everything): branch `refactor/model-provider` —
   define `ModelProvider` interface, extract Gemini logic into `GeminiProvider`,
   behavior-identical. Exit gate: existing Gemini flow works through the interface.
3. Then parallel branches: P2 Claude adapter · P2.5 checkpoint HITL · P2.6 git policy
   · P3 engine select · P4 skill loadouts (core differentiator).
4. UI (P6) waits for backend to settle, then build the unbuilt Skills system (4 screens)
   + Recruit + PM-clarify.

## Environment
- Frontend `npm run dev` → http://localhost:5173 · Backend → http://localhost:3005
- `GEMINI_API_KEY` in `.env` required.

## One small open decision
- Which skills are the always-on **system base set**? Curate at build time.
