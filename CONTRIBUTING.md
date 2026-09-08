# Contributing to Chaperone

Thanks for being here. Chaperone is early, which means feedback is worth more than
code right now — if something confused you, that's a bug report.

## Ways to help, in order of usefulness

1. **Tell us what broke.** Open an issue with what you did, what you expected, and
   what happened. Screenshots of the dashboard help a lot.
2. **Tell us what felt wrong.** Chaperone is a product about control and trust. If a
   moment made you feel out of control, that's important even if nothing crashed.
3. **Code.** See below — there's a CLA step before we can merge patches.

## Before you write code

Please open an issue first and let's agree on the approach. The architecture is
still moving (see [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) and
[docs/DECISIONS.md](docs/DECISIONS.md)), and a good patch against the wrong layer is
still a patch we can't merge.

## Development setup

See [docs/SETUP.md](docs/SETUP.md). Short version: `npm install` at the root and
in `server/`, put a `GEMINI_API_KEY` in `.env`, then run `npm run dev` at the root
and `npm run dev` in `server/`.

## Conventions

- **Commit messages** follow the existing log: `type(scope): what changed and why`,
  e.g. `fix(nav): sidebar PM item had no onClick — wire it to open PM chat`. Say what
  the change does, not what files you touched.
- **Comments** explain *why*, not *what*. The existing code does this consistently —
  match it.
- Keep the diff focused. One concern per PR.

## Contributor License Agreement

Before we can merge your code, you need to sign the
[Contributor License Agreement](CLA.md).

**Why:** Chaperone is released under the AGPL-3.0, and a commercial license is also
offered for people who can't use the AGPL. Offering both requires that one party
holds the necessary rights across the whole codebase. If contributions arrive
without a CLA, that becomes impossible — relicensing later would require tracking
down every past contributor for permission.

**What it does and doesn't do.** You keep the copyright to your contribution. You
grant the project the right to use and relicense it, including commercially. You are
not signing your work away, and your contribution stays available under the AGPL
like everything else.

If that trade doesn't sit right with you, that's a legitimate position — issues,
bug reports, and design feedback need no CLA and are genuinely valuable.
