import path from 'path';

/**
 * Resolve a path an agent asked for, or refuse it.
 *
 * Every path in a tool call arrives from a language model, so it is input, not
 * instruction. `path.resolve` happily accepts `../../..` and absolute paths, which
 * meant an agent could read or write anywhere the process could reach — the user's
 * home, another project, an .env two folders up. Nothing checked. In the autonomy
 * mode that stops asking, nothing prompted either.
 *
 * The project folder is the boundary. Chaperone's own scaffolding is carved out of
 * it as well: an agent must never edit the harness that is supervising it.
 */
export const CHAPERONE_DIRS = ['.chaperone', '.canopy'];   // current name, and the pre-rename one
type Resolved = { ok: true; abs: string } | { ok: false; error: string };
export const resolveInWorkspace = (rel: string, workspacePath: string, forWriting: boolean): Resolved => {
  const root = path.resolve(workspacePath);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return { ok: false, error: `[ERROR] refused: ${rel} is outside the project folder` };
  }
  const first = path.relative(root, abs).split(path.sep)[0];
  if (forWriting && CHAPERONE_DIRS.includes(first)) {
    return { ok: false, error: `[ERROR] refused: ${first}/ is Chaperone's own folder, not yours to write` };
  }
  return { ok: true, abs };
};

