# Running Chaperone

Both halves run on your machine: a Vite frontend and an Express backend that
talks to whichever model you have a key for.

## From source

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

## As a desktop app

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

