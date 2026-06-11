# TODO — Canopy (provider-agnostic refactor)

> Created 2026-06-09 alongside PRD v2. Backend-first: get the engine layer right,
> then align the UI against real functionality. Each assignment = one branch
> (mirrors the platform's own model). **No brute-force deletion** — refactor the
> existing `server/src/index.ts` in place; Gemini code becomes the first adapter.

Legend: ⬜ todo · 🟦 in progress · ✅ done · 🔒 blocked (dependency)

---

## Phase 0 · Housekeeping (do first, fast)
- ⬜ Commit the uncommitted M0+M1 work on `feat/t1-structured-tasks` (or branch off cleanly) so the refactor starts from a known state
- ⬜ Reconcile stale docs: PROJECT_STATE/handoff port mismatch (5173 vs 5174 vs 5175); pick one and fix all
- ⬜ Update CHANGELOG with the v2 pivot entry

## Phase 1 · Foundation — model-provider interface (FOUNDATION, blocks the rest)
**Branch:** `refactor/model-provider`
- ⬜ Define `ModelProvider` interface — ONE job: normalize a vendor's chat + function-calling API into our common shape (messages in → streamed text/tool-calls out). It does NOT own the agent loop, tools, HITL, or skills — those stay in the pipeline.
- ⬜ Define common types: `ChatMessage`, `ToolCall`, `ToolResult`
- ⬜ Extract the existing Gemini logic from `/api/execute-mission` into `providers/GeminiProvider.ts` implementing the interface — behavior must stay identical (regression-safe)
- ⬜ Rewire `/api/execute-mission`, `/api/ceo/chat`, `/api/reviewer`, `/api/panel/:id/nudge` to call the model via the interface, not Gemini directly
- ⬜ Keep the pipeline-owned parts shared & untouched: tool layer (`run_shell`/`read_file`/`write_file`), HITL gate, git checkout, SSE format
- ✅ Exit gate: existing Gemini flow works exactly as before, now through the interface

## Phase 2 · Claude adapter (parallel after P1)
**Branch:** `feat/claude-provider`
- 🔒 Implement `providers/ClaudeProvider.ts` via the **Anthropic Messages API** (tool-use). **Claude is just a model here — do NOT use the Claude Agent SDK / Claude Code agent loop** (that re-introduces vendor lock-in we're avoiding).
- ⬜ Normalize Anthropic's tool-use blocks ↔ our common `ToolCall`/`ToolResult` shape
- ⬜ Stream Anthropic events → existing SSE shape so the frontend needs no change
- ⬜ Confirm the SAME pipeline (tools, HITL, skills, git) drives Claude with zero special-casing
- ⬜ Exit gate: run a 1-worker mission end-to-end on Claude; UX identical to Gemini

## Phase 2.5 · Checkpoint HITL rework (parallel after P1 — corrects v1)
**Branch:** `feat/checkpoint-hitl`
- 🔒 Replace per-tool-call approval (current `require_approval` on EVERY `functionCall`) with **bounded autonomy**: routine actions auto-approved, only policy-flagged sensitive actions pause
- ⬜ Define the sensitive-action policy/allowlist (force-push, delete, secrets, network spend, destructive shell) + user override
- ⬜ Add the **hard stop at task boundary**: worker halts on completion, no auto-merge/auto-next
- ⬜ Human review gate → human-gated merge up to PM → PM replan loop
- ⬜ Per-task cost surfaced + bounded (anti-Paperclip: never act/spend invisibly)
- ⬜ **Per-worker autonomy mode** (default Auto; modes: Ask / Accept-edits / Plan-only / Auto / Bypass), user-overridable per agent — drives what counts as a "sensitive gate"
- ⬜ Exit gate: a worker runs a task autonomously, stops at the boundary, waits for human review before merge

## Phase 2.6 · Git policy & no-git fallback (parallel after P1)
**Branch:** `feat/git-policy`
- 🔒 Detect git on mission start; if not a repo, prompt one-click `git init`
- ⬜ If user declines git → enforce **single-worker sequential mode** (no parallel file edits without isolation)
- ⬜ Keep both coordination layers explicit: communication (fan-out/fan-in via SSE+result) + integration (git branch per assignment)
- ⬜ Exit gate: non-git project either auto-inits git or runs one worker at a time — never parallel-without-isolation

## Phase 3 · Engine detection + selection (parallel after P1)
**Branch:** `feat/provider-selection`
- 🔒 Detect installed/configured engines (claude on PATH, GEMINI_API_KEY, OPENAI_API_KEY, deepseek)
- ⬜ `/api/providers` endpoint returning available engines + capabilities
- ⬜ Persist chosen engine (global default + per-mission + per-worker override)
- ⬜ Exit gate: user can pick Gemini vs Claude before dispatch

## Phase 4 · Skill loadouts (parallel after P1 — the core differentiator)
**Branch:** `feat/skill-loadouts`
4 layers; heart is **human-equipping** (game-loadout). **Design exists in
`wf-skills.jsx` (screens 11/12/13a/13b); App.tsx has only the Add-Skill modal +
read-only equipped list — the rest must be BUILT.**
- 🔒 **(L1) Modular skill model** + metadata: name, description, category, role tags, **source provenance** (built-in / yours / GitHub) + **GitHub auto-resync**
- ⬜ **(L1) Skill Library page** (screen 11) — BUILD: search, category filters+counts, sort (most-used/newest/by-role), source badges, usage count
- ⬜ **(L1) Import** (screen 12) — BUILD tabs: Upload .md / GitHub link (fetch+resync) / Paste raw (only paste exists today); equip-immediately-on option
- ⬜ **(G2) Three-tier authority** — system default (base, always-on) / PM suggestion (suggest-only + one-click accept·mount) / human loadout (highest). Conflict precedence: **human > PM > base**
- ⬜ **(L2 core) Worker Loadout editor** (screen 13a) — BUILD: drag Library→slots, reorder, ✕ unequip; **capacity = always-on base set + ~8–10 custom slots** (not 6); **apply-saved-set with diff preview** (keep/add/drop → replace/merge)
- ⬜ **(L2 core) Save-gated edits (HITL for skills)** — loadout changes don't hit the worker until saved ("affects next tool call"); discard to revert; no auto-save. **(G6) Editing a *running* worker = sensitive action → checkpoint gate**
- ⬜ **(G4) Show estimated token cost per loadout** (each equipped skill = system-prompt tokens)
- ⬜ **(L2 core) Compose Set** (screen 13b) — BUILD: reusable set, save target (private/shared/community), **seed onto a role preset** (default kit per role)
- ⬜ **(L3 assist) Suggestion** — PM *proposes* fitting skills (description→task), human accepts/edits via "accept·mount"; never silent auto-load
- ⬜ **(L4 plumbing, G1) Runtime injection** — **one neutral `SKILL.md`** (skill-creator format), injected as system-prompt text **uniformly for every model**; **no per-engine translation** (Claude is just a model); existing `readSkillContent` path
- ⬜ Exit gate: human opens a worker's loadout, drags skills within capacity, saves, dispatches → worker runs with exactly that loadout, identical across models

## Phase 5 · GPT / DeepSeek adapters (later, parallel)
**Branch:** `feat/openai-provider`, `feat/deepseek-provider`
- 🔒 `OpenAIProvider` (reuse Gemini-style raw-LLM loop via OpenAI SDK)
- ⬜ `DeepSeekProvider` (OpenAI-compatible endpoint)

## Phase 6 · UI alignment (AFTER backend settles)
**Branch:** `feat/ui-provider-and-skills`
- 🔒 Engine picker in onboarding + mission composer
- ⬜ Skill-routing UI: role loadouts, auto-suggested skills, saved sets (PLAN_v2 sections 2 + 4, re-scoped around the new model)
- ⬜ Per-provider cost/usage display
- ⬜ Re-scope the remaining PLAN_v2 wireframe screens (3.x) against real backend behavior — drop screens that assumed Gemini-only

---

## Dependency graph
```
P0 ──▶ P1 (foundation) ──┬──▶ P2   Claude adapter    ──┐
                         ├──▶ P2.5 checkpoint HITL    ──┤
                         ├──▶ P2.6 git policy         ──┤
                         ├──▶ P3   engine select      ──┼──▶ P6 UI alignment
                         └──▶ P4   skill loadouts     ──┘
                                                          P5 (GPT/DeepSeek) anytime after P1
```
P1 is the single chokepoint. Once the interface exists, P2 / P2.5 / P2.6 / P3 / P4
are five independent branches that parallelize cleanly. P6 (UI) waits for the
backend to settle.
