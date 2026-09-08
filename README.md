# Chaperone

**An AI dev team that works to a process — so its usual mistakes don't become yours.**

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

![Four workers running in parallel, each on its own branch, one paused for approval](docs/screenshots/mission-4-workers.png)

*Four workers on four branches. W2 has stopped mid-task and is holding a `write_file` call until you approve it — nothing touches your repo before you say so.*

---

## What it looks like

<table>
<tr>
<td width="50%">

**The PM reads your project first**

![PM exploring the repository](docs/screenshots/pm-scan.png)

It calls read-only tools and reports what it actually found — the files listed are the ones it opened.

</td>
<td width="50%">

**Two workers, side by side**

![Two workers side by side](docs/screenshots/mission-2-workers.png)

Layout follows the worker count: one fills the frame, two split it, three or four take a 2×2.

</td>
</tr>
<tr>
<td width="50%">

**Skills are equipped, not configured**

![Skill library](docs/screenshots/skills-library.png)

Read from your own skills directory. Search, categorise, and save reusable sets.

</td>
<td width="50%">

**Hiring a worker takes three steps**

![Recruit a worker](docs/screenshots/recruit-worker.png)

Pick a role, equip skills, name it. The branch prefix is derived from the role.

</td>
</tr>
<tr>
<td width="50%">

**Loadouts per worker**

![Worker loadout](docs/screenshots/worker-loadout.png)

Limited slots, on purpose: arming an agent should be a visible decision.

</td>
<td width="50%">

**Bring your own model**

![API key settings](docs/screenshots/settings-keys.png)

Claude, OpenAI, Gemini, or anything with an OpenAI-style API — Kimi, DeepSeek, GLM, Qwen, a local Ollama.

</td>
</tr>
</table>

> **On these screenshots.** The PM scan, skill library, recruiting and settings are
> live screens with real data. The mission frames use a sample mission: the
> orchestration UI, approval gates and layout are the real components, but no
> models were run to produce them. The mission plan screen below is a design
> preview whose content is still hardcoded — see
> [docs/UI_AUDIT.md](docs/UI_AUDIT.md), which lists everything in the app that is
> drawn but not yet wired.

<details>
<summary>Mission plan (design preview — content not yet wired)</summary>

![Mission plan](docs/screenshots/mission-plan.png)

</details>

---

## Why it exists

People who can't code can now get software written for them. What they can't do is
tell when the AI is quietly going wrong — and it goes wrong in the same handful of
ways every time. It loses the thread across several features at once. It rewrites
something that already worked. It reports success it did not achieve. It burns
tokens for an hour with nothing to show. A developer catches these by instinct;
someone without that instinct only finds out much later, when the project is
already tangled.

**Chaperone's job is to catch them for you.** The process is the product: an
operating model the agents work inside, checkpoints where a human has to look, one
worker per git branch so mistakes stay contained, and a reviewer that reads the
diffs before anything merges. Not a smarter model — a structure around the model
that makes its usual failures visible early and cheap to undo.

The second half is the skills. An agent is only as good as what it has been given
to work with, so capabilities are equipped onto each worker deliberately and
visibly, the way you'd staff a role rather than hope a general-purpose assistant
guesses right.

**You bring your own model key.** Chaperone talks to Claude, OpenAI or Gemini with
your key; you pay the provider directly and it never sees your bill.

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
- An API key for **at least one** model provider — Chaperone runs the same
  pipeline on any of them:

  | Provider | Key | Get one |
  | --- | --- | --- |
  | Claude (Anthropic) | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
  | OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
  | Gemini (Google) | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |

  Plus one slot for **any other OpenAI-compatible endpoint** — DeepSeek, Kimi,
  GLM, Qwen, OpenRouter, or a local Ollama / vLLM server. They speak the same
  dialect, so they need no adapter of their own: set a base URL and go. It is an
  API key, not a partnership.

- `git` on your PATH (Chaperone uses branches to isolate parallel work)

**Setup**

```bash
git clone https://github.com/LinzhiW/chaperone.git
cd chaperone
npm install
cd server && npm install && cd ..
```

Add your key(s). The backend reads its environment from **`server/.env`** — copy
the template and fill in whichever providers you have:

```bash
cp server/.env.example server/.env
```

You can also skip this and paste keys into the app's Settings dialog later; it
writes them to the same file.

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

**Choosing the engine.** With more than one configured, Chaperone picks in the
order Custom → Claude → OpenAI → Gemini (a custom endpoint leads because filling
one in is a deliberate act). Settings → *Model engine* pins a specific one, and the
model id per provider is overridable there or via `ANTHROPIC_MODEL`,
`OPENAI_MODEL`, `GEMINI_MODEL`, `CUSTOM_MODEL`.

One caveat on custom endpoints: the pipeline leans on function calling. An endpoint
that only partly implements OpenAI-style tool calls can connect fine and then stall
once workers start using tools.

**Other environment variables**

| Variable | Purpose |
| --- | --- |
| `SKILLS_PATH` | Where to look for skill definitions |
| `HTTPS_PROXY` | Honored by the backend for model API calls |

---

## Desktop app

Chaperone also runs as a desktop app, which is the easier way to use it: one
window instead of two terminals, and — because a web page can never learn a real
filesystem path — a **native folder picker** instead of typing paths by hand.

```bash
npm run desktop          # build both halves, then launch
```

To iterate on the UI with hot reload, run `npm run dev` in one terminal and:

```bash
npm run desktop:dev      # loads the Vite server inside the Electron window
```

To produce a distributable:

```bash
npm run dist             # unpacked app in release/
npm run dist:installer   # installer / portable exe
```

**Where its settings live.** The desktop app keeps credentials in the per-user
application data folder, *not* in `server/.env` — the install directory is
read-only for non-admins. So the desktop build starts with no keys even if
`server/.env` is populated; add them once under Settings.

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\chaperone\.env` |
| macOS | `~/Library/Application Support/chaperone/.env` |
| Linux | `~/.config/chaperone/.env` |

The embedded backend binds to an OS-assigned free port rather than 3005, so
nothing collides with whatever else is running.

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
