# Chaperone API Contract (v1) — for the parallel build

All team/skill data is **user-defined** and starts **empty**. Persist as JSON files
under `<projectPath>/.chaperone/` (`team.json`, `saved-sets.json`, `role-presets.json`).
Shared types: [`src/chaperoneTypes.ts`](../src/chaperoneTypes.ts). Backend base: `http://localhost:3005`.
This contract is the single source of truth so the frontend and backend agents stay in sync.

## Team (recruited workers — persistent)
- `GET    /api/team?workspacePath=…`                         → `{ workers: Worker[] }`
- `POST   /api/team`     body `{ workspacePath, worker }` (no id) → `{ worker }` (server assigns next `W#`)
- `PUT    /api/team/:id` body `{ workspacePath, patch }` (incl. `loadout`)  → `{ worker }`
- `DELETE /api/team/:id?workspacePath=…`                     → `{ ok: true }`

## Saved sets (reusable skill combos)
- `GET    /api/saved-sets?workspacePath=…`                   → `{ sets: SavedSet[] }`
- `POST   /api/saved-sets` `{ workspacePath, set }` (no id)  → `{ set }`
- `PUT    /api/saved-sets/:id` `{ workspacePath, patch }`    → `{ set }`
- `DELETE /api/saved-sets/:id?workspacePath=…`               → `{ ok: true }`

## Role presets (seed the 6 built-ins; user may add)
- `GET    /api/role-presets?workspacePath=…`                 → `{ presets: RolePreset[] }`
  Seed from `.design/agent-company/project/wf-skills-data.jsx` `ROLE_PRESETS`
  (Frontend/Backend/Mobile/QA/DevOps/Data, each with branchPrefix + defaultSkillIds).

## Skills library (existing endpoint — enrich)
- `GET /api/skills` → `{ skills: { name, description, category?, source? }[] }`
  Already returns name+description from `~/.agents/skills`. Add `category`/`source` if cheap.

## PM clarify step (NEW — replaces the hardcoded briefing demo)
`POST /api/ceo/chat` returns ONE of these shapes (add a `kind` field):
- `{ kind: 'clarify', text, questions: ClarifyQuestion[] }` — if the brief is ambiguous, PM asks 1–3 questions first
- `{ kind: 'plan',    text, plan: Assignment[] }`           — if clear (or after answers), PM outputs the plan
- `{ kind: 'message', text }`                               — general conversation

Frontend sends `{ message, history, files, clarifyAnswers? }`. When `clarifyAnswers`
is present, PM incorporates them and returns a `plan`.
**Back-compat:** keep emitting the legacy `text` + `<<<TASK_PLAN>>>` markers too, so the
current reconnected flow keeps working while the frontend migrates to `kind`.

## Persistence note
Store under the project's `.chaperone/` dir (created next to `.chaperone/PRD.md` etc. by
`/api/init-project`). Read-on-GET, write-on-mutation. Missing file = empty list.
