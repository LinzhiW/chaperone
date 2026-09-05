# Chaperone

**Your AI dev team — run like a company, not a command line.**

Chaperone makes you the founder of an AI software team. You set a goal. A **PM
agent** plans it and splits it into assignments. Each **Worker** builds its piece
**on its own git branch**, so parallel work never collides. A **Reviewer** audits
the diffs. Then **you** decide what merges.

It's built for people who have the ideas but were locked out by the terminal —
founders, designers, PMs, indie hackers. You direct; the team builds; you sign off.

> **Status: early and opinionated.** The core loop (PM → Workers on branches →
> Reviewer → merge) runs today. The provider-agnostic backend and the skill system
> are actively being built. Expect rough edges and breaking changes. See
> [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for an honest designed-vs-built
> audit.

---

## Why it exists

Build several features at once with a single AI agent and it loses the thread —
context bleeds between tasks and you drown in back-and-forth. Multiple coordinated
agents solve this, but the tools that can do it live in the terminal and fail one of
two ways: they make you approve every tiny click, or they run loose in the
background burning tokens while you have no idea what happened.

Chaperone answers both. Agents work autonomously *within* a task, pause only for
genuinely sensitive moves, then **stop at the task boundary and wait for you to
review and merge**.

**Brain in the cloud, hands on your machine.** The model thinks; the work happens
locally, in your repo, with your own git auth. This is a tool you run — not a
service you hand your code to.

## Design principles

1. **Don't rebuild the engine — own the layer above it.** We don't compete with the
   agent execution loop. We own orchestration, safety, and skills.
2. **Bring your own model.** One pipeline, any backend. The platform owns the
   behavior; the model is a swappable part.
3. **Skill loadouts.** Reusable capabilities are equipped onto each agent like gear
   in a game — drag into limited slots, save sets, set role defaults. Arming an
   agent is a visible, deliberate act, not a hidden config file.
4. **You stay in command.** Nothing runs or spends a token invisibly.

---

## Running it

**Requirements**

- Node.js 20+
- A Gemini API key ([get one here](https://aistudio.google.com/apikey)) — the
  execution engine is Gemini-only today; the multi-provider adapter layer is in
  progress
- `git` on your PATH (Chaperone uses branches to isolate parallel work)

**Setup**

```bash
git clone https://github.com/LinzhiW/chaperone.git
cd chaperone
npm install
cd server && npm install && cd ..
```

Create a `.env` file in the repo root:

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
```

**Start both halves** (two terminals):

```bash
npm run dev
```

```bash
cd server && npm run dev
```

Then open http://localhost:5173. The backend runs on port 3005.

> Behind a proxy or VPN? The server launcher sets `NODE_USE_ENV_PROXY=1` so Node's
> `fetch` honors `HTTPS_PROXY`, which it otherwise ignores. Just set `HTTPS_PROXY`
> in your environment.

**Optional environment variables**

| Variable | Purpose |
| --- | --- |
| `GEMINI_MODEL` | Model id (default `gemini-2.5-flash`) |
| `SKILLS_PATH` | Where to look for skill definitions |
| `HTTPS_PROXY` | Honored by the backend for model API calls |

---

## How it's laid out

```
src/                 React + Vite frontend
  App.tsx            main shell — onboarding, PM chat, mission dashboard, reviewer
  skills/            skill library, import, loadout, compose-set
  recruit/           worker recruiting + role presets
  chaperoneTypes.ts  shared types (team / skills / loadouts / saved sets)
server/
  src/index.ts       Express API — mission execution, PM chat, reviewer, git ops
  src/persistence.ts JSON persistence under <project>/.chaperone/
docs/                PRD, project state, decisions, operating model
```

**Per-project data.** Chaperone writes its state into a `.chaperone/` folder inside
*the project you point it at* — plan, progress, role presets. Your code stays yours;
Chaperone only adds that one folder.

---

## Contributing

Issues and discussion are very welcome. Before sending code, please read
[CONTRIBUTING.md](CONTRIBUTING.md) — contributions require signing a Contributor
License Agreement.

## License

[GNU AGPL-3.0](LICENSE).

In plain terms: you can run, study, modify, and share this freely. If you run a
modified version as a network service, you have to publish your changes too.

If the AGPL doesn't work for your situation, a separate commercial license is
available — open an issue or get in touch.
