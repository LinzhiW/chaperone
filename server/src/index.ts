import express from 'express';
import cors from 'cors';
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getProvider, setProviderOverride, getProviderOverride, availableProviders, ProviderId, setUsageRecorder } from './providers';
import { loadRates, RATES_CHECKED, PRICING_SOURCES, effectiveRates, ratesFilePath } from './pricing';
import { loadUsage, recordUsage, totals, totalsForScope, byModel, recentEntries } from './usage';
import { ChatSession } from './providers/types';
import * as store from './persistence';
import { exec, execFile } from 'child_process';
import dotenv from 'dotenv';
import { shouldUseSearchGrounding, generateContentWithGoogleSearch } from './utils/googleSearchGrounding';

// Where the .env lives. In `npm run dev` this is the server/ directory (the
// launcher sets cwd there). In the packaged desktop app the working directory is
// wherever the OS started the executable, which is read-only on some platforms —
// so the shell passes a writable per-user location via CHAPERONE_DATA_DIR and we
// keep credentials there instead.
export const DATA_DIR = process.env.CHAPERONE_DATA_DIR || process.cwd();
export const ENV_PATH = path.join(DATA_DIR, '.env');

dotenv.config({ path: ENV_PATH });

// Metering has to be armed before anything can call a model.
loadRates(DATA_DIR);
loadUsage(DATA_DIR);
setUsageRecorder(recordUsage);

const app = express();
// 0 asks the OS for any free port. The desktop shell needs this — it cannot
// assume 3005 is free on a user's machine — and reads the real port back from
// the listen callback. Plain `npm run dev` keeps the documented 3005.
const port = Number(process.env.PORT ?? 3005);

app.use(cors());
app.use(express.json());

// --- Configuration ---
const getApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const getModelId = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// --- Mission Management ---
interface PendingAction {
  resolve: (approved: boolean) => void;
  toolCall: any;
}
const activeMissions = new Map<string, PendingAction>();

// --- Per-panel sessions (T3) ---
interface PanelSession {
  session: ChatSession;   // provider-agnostic chat session
  workspacePath: string;
}
const panelSessions = new Map<string, PanelSession>();
const activePanels  = new Set<string>();  // panels with live SSE connection

// --- Skill Loadout (T4) ---
const getSkillsDir = () =>
  process.env.SKILLS_PATH || path.join(os.homedir(), '.agents', 'skills');

const listSkills = (): { name: string; description: string }[] => {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .map(name => {
      const skillFile = path.join(dir, name, 'SKILL.md');
      let description = '';
      if (fs.existsSync(skillFile)) {
        const m = fs.readFileSync(skillFile, 'utf-8').match(/description:\s*"([^"]+)"/);
        if (m) description = m[1];
      }
      return { name, description };
    });
};

const readSkillContent = (skillName: string): string | null => {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) return null;
  const normalized = skillName.toLowerCase().replace(/[\s_]+/g, '-');
  const match = fs.readdirSync(dir).find(f =>
    f.toLowerCase() === normalized || f.toLowerCase() === skillName.toLowerCase()
  );
  if (!match) return null;
  const skillFile = path.join(dir, match, 'SKILL.md');
  return fs.existsSync(skillFile) ? fs.readFileSync(skillFile, 'utf-8') : null;
};

// --- Agent Tools ---
const runShell = (command: string, workspacePath: string): Promise<string> => {
  return new Promise((resolve) => {
    if (command.includes('rm -rf /')) return resolve('[ERROR] Dangerous command blocked.');
    exec(command, { cwd: workspacePath }, (error, stdout, stderr) => {
      resolve(error ? `[ERROR] ${stderr || error.message}` : stdout || '[OK] Success.');
    });
  });
};

const readFile = (filePath: string, workspacePath: string): string => {
  try { return fs.readFileSync(path.resolve(workspacePath, filePath), 'utf-8'); }
  catch (err: any) { return `[ERROR] ${err.message}`; }
};

// Controlled, append-only write — scoped to docs/*.md. Used by the PM checkpoint so
// clearing a conversation is safe: decisions/progress get persisted to the durable docs
// (the PM's real memory) rather than living only in the chat transcript.
const ALLOWED_DOC_RE = /^docs\/[A-Za-z0-9_.-]+\.md$/;
const appendDoc = (rel: string, content: string, workspacePath: string): string => {
  if (!ALLOWED_DOC_RE.test(rel)) return `[ERROR] can only append to docs/*.md, got: ${rel}`;
  try {
    const docsDir = path.resolve(workspacePath, 'docs');
    const abs = path.resolve(workspacePath, rel);
    if (!abs.startsWith(docsDir + path.sep) && abs !== docsDir) return '[ERROR] path escapes docs/';
    fs.mkdirSync(docsDir, { recursive: true });
    const existed = fs.existsSync(abs);
    fs.appendFileSync(abs, (existed ? '\n' : '') + content.trim() + '\n');
    return `[OK] appended ${content.length} chars to ${rel}${existed ? '' : ' (created)'}`;
  } catch (err: any) { return `[ERROR] ${err.message}`; }
};

const writeFile = (filePath: string, content: string, workspacePath: string): string => {
  try {
    const fullPath = path.resolve(workspacePath, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    return `[OK] Wrote to ${filePath}`;
  } catch (err: any) { return `[ERROR] ${err.message}`; }
};

// --- Agent tool schemas (provider-agnostic; pipeline owns the tools) ---
const TOOL_DEFS = [
  { name: "run_shell", description: "Run shell command", parameters: { type: "OBJECT", properties: { command: { type: "STRING" } }, required: ["command"] } },
  { name: "read_file", description: "Read file", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
  { name: "write_file", description: "Write file", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } },
];

// --- Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'online' }));

app.get('/api/skills', (req, res) => res.json({ skills: listSkills() }));

// ─── Persistence: Team / Saved Sets / Role Presets ──────────────────────────
// JSON files under <workspacePath>/.chaperone/. Missing file = empty list.
// See docs/API_CONTRACT.md.

const getWorkspacePath = (req: any): string | undefined =>
  (req.query.workspacePath as string) || (req.body && req.body.workspacePath);

// Team (recruited workers)
app.get('/api/team', (req, res) => {
  const ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  try { res.json({ workers: store.getWorkers(ws) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/team', (req, res) => {
  const { workspacePath, worker } = req.body || {};
  if (!workspacePath || !worker) return res.status(400).json({ error: 'Missing workspacePath or worker' });
  try { res.json({ worker: store.addWorker(workspacePath, worker) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/team/:id', (req, res) => {
  const { workspacePath, patch } = req.body || {};
  if (!workspacePath || !patch) return res.status(400).json({ error: 'Missing workspacePath or patch' });
  try {
    const worker = store.updateWorker(workspacePath, req.params.id, patch);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ worker });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/team/:id', (req, res) => {
  const ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  try {
    const ok = store.deleteWorker(ws, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Worker not found' });
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Saved sets (reusable skill combos)
app.get('/api/saved-sets', (req, res) => {
  const ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  try { res.json({ sets: store.getSavedSets(ws) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/saved-sets', (req, res) => {
  const { workspacePath, set } = req.body || {};
  if (!workspacePath || !set) return res.status(400).json({ error: 'Missing workspacePath or set' });
  try { res.json({ set: store.addSavedSet(workspacePath, set) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/saved-sets/:id', (req, res) => {
  const { workspacePath, patch } = req.body || {};
  if (!workspacePath || !patch) return res.status(400).json({ error: 'Missing workspacePath or patch' });
  try {
    const set = store.updateSavedSet(workspacePath, req.params.id, patch);
    if (!set) return res.status(404).json({ error: 'Saved set not found' });
    res.json({ set });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/saved-sets/:id', (req, res) => {
  const ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  try {
    const ok = store.deleteSavedSet(ws, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Saved set not found' });
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Role presets (seeds the 6 built-ins on first GET)
app.get('/api/role-presets', (req, res) => {
  const ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  try { res.json({ presets: store.getRolePresets(ws) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/files', (req, res) => {
  const projectPath = req.query.path as string;
  if (!projectPath || !fs.existsSync(projectPath)) return res.status(400).json({ error: 'Invalid path' });
  try {
    const files = fs.readdirSync(projectPath).filter(f => !['node_modules', '.git', 'dist'].includes(f));
    res.json({ files });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// --- File tree with git status ---
// The sidebar used to show one flat readdir with no indication of what had
// changed, which is the thing you most want to see after workers have been
// running. This returns a real nested tree plus a per-path status so additions,
// modifications and deletions are visible without leaving the app.

type TreeNode = {
  name: string;
  path: string;                       // workspace-relative, forward-slashed
  type: 'file' | 'dir';
  status?: 'A' | 'M' | 'D';           // added/untracked, modified, deleted
  children?: TreeNode[];
};

/** Resolve a workspace-relative path, refusing anything that escapes the root. */
function safeResolve(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  return full === rootResolved || full.startsWith(rootResolved + path.sep) ? full : null;
}

/** Map simple-git's status into one letter per path. */
async function gitStatusMap(workspacePath: string): Promise<Record<string, 'A' | 'M' | 'D'>> {
  const map: Record<string, 'A' | 'M' | 'D'> = {};
  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) return map;
    const st = await git.status();
    const norm = (p: string) => p.replace(/\\/g, '/');
    for (const f of st.not_added) map[norm(f)] = 'A';
    for (const f of st.created) map[norm(f)] = 'A';
    for (const f of st.deleted) map[norm(f)] = 'D';
    for (const f of st.modified) map[norm(f)] = 'M';
    for (const f of st.renamed) map[norm((f as any).to || '')] = 'A';
  } catch { /* not a repo, or git unavailable — the tree still renders */ }
  return map;
}

app.get('/api/files/tree', async (req, res) => {
  const workspacePath = expandHome(String(req.query.workspacePath || ''));
  if (!workspacePath || !fs.existsSync(workspacePath)) return res.status(400).json({ error: 'Invalid path' });

  const status = await gitStatusMap(workspacePath);

  let count = 0;
  const MAX = 4000;
  const build = (dir: string, rel: string, depth: number): TreeNode[] => {
    if (depth > 8 || count >= MAX) return [];
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }

    const nodes: TreeNode[] = [];
    for (const e of entries) {
      if (count >= MAX) break;
      if (TREE_IGNORE.has(e.name)) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      count++;
      if (e.isDirectory()) {
        const children = build(path.join(dir, e.name), childRel, depth + 1);
        nodes.push({ name: e.name, path: childRel, type: 'dir', children });
      } else {
        nodes.push({ name: e.name, path: childRel, type: 'file', ...(status[childRel] ? { status: status[childRel] } : {}) });
      }
    }
    // Directories first, then alphabetical — the order a file explorer uses.
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1);
    return nodes;
  };

  // Deleted files are gone from disk, so they never appear in the walk — add them
  // back, otherwise "what was removed" is exactly what you cannot see.
  const deleted = Object.entries(status)
    .filter(([, s]) => s === 'D')
    .map(([p]) => ({ name: p.split('/').pop() || p, path: p, type: 'file' as const, status: 'D' as const }));

  res.json({ tree: build(workspacePath, '', 0), deleted, truncated: count >= MAX });
});

// Read one file for the viewer. For a modified file the diff is the useful view —
// that is what "what changed" means — so it is returned alongside the content.
app.get('/api/files/content', async (req, res) => {
  const workspacePath = expandHome(String(req.query.workspacePath || ''));
  const rel = String(req.query.path || '');
  if (!workspacePath || !rel) return res.status(400).json({ error: 'Missing workspacePath or path' });

  const full = safeResolve(workspacePath, rel);
  if (!full) return res.status(400).json({ error: 'Path escapes the workspace' });

  const status = (await gitStatusMap(workspacePath))[rel.replace(/\\/g, '/')];

  let diff = '';
  if (status === 'M' || status === 'D') {
    try { diff = await simpleGit(workspacePath).diff(['--', rel]); } catch { /* leave empty */ }
  }

  if (status === 'D' || !fs.existsSync(full)) {
    return res.json({ path: rel, status: status || null, content: '', diff, deleted: true });
  }

  try {
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return res.status(400).json({ error: 'That is a directory' });
    if (stat.size > 1_000_000) {
      return res.json({ path: rel, status: status || null, content: '', diff, tooLarge: true, size: stat.size });
    }
    const buf = fs.readFileSync(full);
    // Crude but effective binary check: a NUL byte in the first 4KB.
    if (buf.subarray(0, 4096).includes(0)) {
      return res.json({ path: rel, status: status || null, content: '', diff, binary: true, size: stat.size });
    }
    res.json({ path: rel, status: status || null, content: buf.toString('utf-8'), diff, size: stat.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update a .env file in place, touching only the given keys.
 *
 * Deliberately a read-modify-write rather than a rewrite: this endpoint used to
 * do `writeFileSync(envPath, 'GEMINI_API_KEY=...')`, which silently wiped every
 * other variable in the file — so saving a Gemini key from the UI destroyed the
 * user's ANTHROPIC_API_KEY and OPENAI_API_KEY. Comments and unrelated lines are
 * preserved; an existing assignment is replaced in place, a new one appended.
 */
function upsertEnvFile(updates: Record<string, string>) {
  const envPath = ENV_PATH;
  let lines: string[] = [];
  try { lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/); } catch { /* no .env yet */ }

  // Trim the trailing blank line the file ends with *before* appending, or every
  // newly added variable lands after a stray empty line.
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex(l => l.trimStart().startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

// Runtime provider credentials. Accepts any subset of the three providers, so
// "bring your own model" works from the UI instead of only by hand-editing .env.
// `googleKey` is the original field name, kept so older clients keep working.
app.post('/api/config', (req, res) => {
  const b = req.body || {};
  const incoming: Record<string, string | undefined> = {
    GEMINI_API_KEY: b.googleKey ?? b.geminiKey,
    GEMINI_MODEL: b.geminiModel,
    ANTHROPIC_API_KEY: b.anthropicKey,
    ANTHROPIC_MODEL: b.anthropicModel,
    OPENAI_API_KEY: b.openaiKey,
    OPENAI_MODEL: b.openaiModel,
    CUSTOM_API_KEY: b.customKey,
    CUSTOM_BASE_URL: b.customBaseUrl,
    CUSTOM_MODEL: b.customModel,
    CUSTOM_LABEL: b.customLabel,
  };

  const updates: Record<string, string> = {};
  for (const [envName, value] of Object.entries(incoming)) {
    if (typeof value === 'string' && value.trim()) updates[envName] = value.trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update — send at least one key or model' });
  }

  // Apply to the live process first so the next getProvider() call picks it up
  // even if the disk write fails (read-only checkout, permissions).
  for (const [envName, value] of Object.entries(updates)) process.env[envName] = value;

  try {
    upsertEnvFile(updates);
  } catch (err) {
    return res.json({
      success: true, persisted: false,
      updated: Object.keys(updates),
      message: 'Applied for this session, but could not write .env',
    });
  }

  res.json({ success: true, persisted: true, updated: Object.keys(updates) });
});

app.post('/api/approve-action', (req, res) => {
  const { taskId, approved } = req.body;
  const pending = activeMissions.get(taskId);
  if (pending) { pending.resolve(approved); activeMissions.delete(taskId); res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found' });
});

app.get('/api/execute-mission', async (req, res) => {
  const { workspacePath, agent, taskName, taskId, skills, branchName } = req.query as any;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type: string, data: any) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  const apiKey = getApiKey();
  if (!apiKey) { sendEvent('log', { log: '> [ERROR] API key missing.' }); return res.end(); }

  // T5: auto git branch checkout
  if (branchName && workspacePath) {
    try {
      const git = simpleGit(workspacePath);
      if (await git.checkIsRepo()) {
        const branches = await git.branchLocal();
        if (branches.all.includes(branchName)) {
          await git.checkout(branchName);
          sendEvent('log', { log: `> [GIT] Checked out existing branch: ${branchName}` });
        } else {
          await git.checkoutLocalBranch(branchName);
          sendEvent('log', { log: `> [GIT] Created branch: ${branchName}` });
        }
      }
    } catch (err: any) {
      sendEvent('log', { log: `> [GIT] Branch setup skipped: ${err.message}` });
    }
  }

  try {
    // Build system instruction with skill loadout
    const skillNames: string[] = skills ? JSON.parse(skills) : [];
    const loadedSkills = skillNames
      .map(name => { const c = readSkillContent(name); return c ? `\n=== SKILL: ${name} ===\n${c}` : null; })
      .filter(Boolean) as string[];

    const systemInstruction = [
      `You are ${agent}, a specialized development agent.`,
      `Mission: ${taskName}`,
      `Workspace: ${workspacePath}`,
      loadedSkills.length > 0
        ? `\nYou have the following skills loaded — follow their guidance:\n${loadedSkills.join('\n')}`
        : '',
      '\nUse tools to act. Always state your intent before calling a tool.',
    ].join('\n');

    // Provider-agnostic chat session (TODO P1). Pipeline owns the loop/HITL/tools.
    const provider = getProvider(`mission:${taskId}`);
    const session = provider.startChat({ system: systemInstruction, tools: TOOL_DEFS });

    // Store session so nudge endpoint can continue the conversation later
    panelSessions.set(taskId, { session, workspacePath });
    activePanels.add(taskId);

    const skillLog = loadedSkills.length > 0
      ? ` · skills: ${skillNames.join(', ')}`
      : '';
    sendEvent('log', { log: `> [SYSTEM] Agent initialized (${provider.modelLabel}${skillLog}).` });

    let turn = await session.sendMessage('Begin. State your plan first.');
    for (let i = 0; i < 10; i++) {
      if (turn.toolCalls.length > 0) {
        for (const call of turn.toolCalls) {
          sendEvent('require_approval', { tool: call.name, args: call.args });
          const approved = await new Promise<boolean>((resolve) => activeMissions.set(taskId, { resolve, toolCall: call }));
          if (!approved) { sendEvent('log', { log: `> [DENIED] Stopping.` }); activePanels.delete(taskId); return res.end(); }

          let output = "";
          if (call.name === "run_shell") output = await runShell((call.args as any).command, workspacePath);
          else if (call.name === "read_file") output = readFile((call.args as any).path, workspacePath);
          else if (call.name === "write_file") output = writeFile((call.args as any).path, (call.args as any).content, workspacePath);

          sendEvent('log', { log: `> [OUTPUT] ${output.substring(0, 300)}` });
          turn = await session.sendToolResults([{ name: call.name, result: output }]);
        }
      } else {
        if (turn.text) sendEvent('log', { log: `> [FINAL] ${turn.text}` });
        break;
      }
    }
    // Commit the worker's changes to its branch so they become a real diff the CEO can
    // review (/api/diff) and merge (/api/merge) — both operate on committed history.
    if (branchName && workspacePath) {
      try {
        const git = simpleGit(workspacePath);
        if (await git.checkIsRepo()) {
          const status = await git.status();
          if (status.files.length > 0) {
            await git.add('.');
            await git.commit(`worker(${agent}): ${taskName}`.slice(0, 200));
            sendEvent('log', { log: `> [GIT] Committed ${status.files.length} file(s) to ${branchName}` });
          } else {
            sendEvent('log', { log: `> [GIT] No file changes to commit.` });
          }
        }
      } catch (err: any) {
        sendEvent('log', { log: `> [GIT] Commit skipped: ${err.message}` });
      }
    }
    activePanels.delete(taskId);
    res.end();
  } catch (err: any) {
    activePanels.delete(taskId);
    sendEvent('log', { log: `> [CRITICAL ERROR] ${err.message}` });
    res.end();
  }
});

app.post('/api/ceo/chat', async (req, res) => {
  const { message, history, files, clarifyAnswers, workspacePath } = req.body;
  const apiKey = getApiKey();
  const modelId = getModelId();
  if (!apiKey) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });

  try {
    const fileList = files && files.length > 0 ? files.join(', ') : "None";
    const availableSkills = listSkills().map(s => s.name).join(', ') || 'none loaded';

    // Ground the PM in the REAL project: read README + package.json so it knows the
    // actual product and name — not just folder names. (Same files the review reads.)
    let projectContext = '';
    if (workspacePath) {
      let ws = workspacePath; if (ws.startsWith('~')) ws = path.join(os.homedir(), ws.slice(1));
      const readMaybe = (rels: string[], max = 3000) => {
        for (const rel of rels) { const p = path.join(ws, rel); try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').slice(0, max); } catch {} }
        return '';
      };
      const readme = readMaybe(['README.md', 'readme.md', 'docs/README.md']);
      const pkg = readMaybe(['package.json'], 1200);
      if (readme || pkg) {
        projectContext = `\n\nYou are working on THIS specific project — ground every answer in its real files below, refer to it by its real name, and never describe it generically:\n=== README ===\n${readme || '(none)'}\n=== package.json ===\n${pkg || '(none)'}`;
      }
    }

    // When the frontend re-sends clarify answers, fold them into the prompt and
    // force the PM straight to a plan (no second round of questions).
    const answersBlock = clarifyAnswers && Object.keys(clarifyAnswers).length > 0
      ? `\nThe user has answered your clarifying questions:\n${Object.entries(clarifyAnswers)
          .map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nUse these answers to produce the plan now. Do NOT ask more questions.`
      : '';

    // If the user isn't writing in English (CJK detected), force the reply language.
    const nonEnglish = /[一-鿿぀-ヿ가-힯]/.test(message || '');
    const langDirective = nonEnglish
      ? `\n\n>>> LANGUAGE: Reply ENTIRELY in the user's own language (the language of their latest message), never English.`
      : '';

    const systemPrompt = `${nonEnglish ? 'TOP PRIORITY: The user is writing in a non-English language (e.g. Chinese). You MUST write your entire reply in that same language — never English. This overrides any tendency to answer in English.\n\n' : ''}You are the Project Orchestrator (PM) of a multi-agent development platform.
Context: Workspace files: ${fileList}.
Available skills (use these exact names in skill_loadout): ${availableSkills}.${projectContext}

You respond in ONE of three modes, signalled by a leading control marker on the FIRST line:

1) CLARIFY — when a goal/feature brief is AMBIGUOUS (unclear scope, missing target,
   multiple reasonable interpretations), ask 1-3 short clarifying questions FIRST.
   Output a JSON object wrapped in <<<CLARIFY>>> ... <<<END_CLARIFY>>> markers:
<<<CLARIFY>>>
[
  { "key": "scope",  "label": "Scope of the change", "options": ["Whole app", "Single page", "API only"] },
  { "key": "target", "label": "Which surface",        "options": ["Web", "Mobile", "Both"] }
]
<<<END_CLARIFY>>>
   Each question: a short "key", a human "label", and 2-4 "options" chips.
   After the markers, write one sentence telling the user you need a bit more info.

2) PLAN — ONLY when the user is EXPLICITLY asking you to WRITE, MODIFY, ADD, FIX, or
   REFACTOR code / files (a build request that will change the repo), AND the brief is
   CLEAR (or the user already answered your questions). PLAN dispatches real workers on
   git branches — never use it for anything read-only.
   Output the task plan as a JSON array wrapped in <<<TASK_PLAN>>> markers:
<<<TASK_PLAN>>>
[
  {
    "agent_id": "frontend-worker",
    "task": "Add dark mode toggle to Settings panel",
    "branch_name": "feat/dark-mode",
    "skill_loadout": ["TDD-Expert", "Frontend"]
  },
  {
    "agent_id": "backend-worker",
    "task": "Add /api/theme endpoint to persist user preference",
    "branch_name": "feat/theme-api",
    "skill_loadout": ["Cloud-Deploy"]
  }
]
<<<END_TASK_PLAN>>>
   Then explain the plan in 2-3 sentences.

3) MESSAGE — the DEFAULT. For general conversation AND for any request to UNDERSTAND,
   READ, EXPLAIN, SUMMARIZE, REVIEW, AUDIT, or REPORT on the project or its progress.
   These are YOUR OWN read-only work as the PM — do them yourself in prose, do NOT
   dispatch workers. Just reply normally with no markers.

Rules:
- ALWAYS reply in the SAME language the user writes in (e.g. Chinese in -> Chinese out). This applies to all prose, clarifying-question labels/options, and plan explanations.
- CRITICAL: Only enter PLAN mode when the user explicitly wants code CHANGED (build/add/fix/refactor/modify). "Look at / go over / understand / check progress / explain / audit / what is this project" are READ-ONLY — answer them yourself in MESSAGE mode, never dispatch a worker or branch for them. Reading files is the PM's own job.
- Use CLARIFY at most once per brief; if the user already answered, go straight to PLAN.
- agent_id must be unique and descriptive (e.g. "frontend-worker", "data-worker").
- branch_name must follow git convention: feat/<short-slug>.
- skill_loadout lists relevant skills from the workspace skill pool.${answersBlock}${langDirective}`;

    // Always route through the provider. (The old grounded-search path passed an
    // unsupported role:'system' to Gemini, which errored on some messages.)
    const groundingSources: any = undefined;
    const session = getProvider('pm-chat').startChat({ system: systemPrompt, history: history || [] });
    const turn = await session.sendMessage(message);
    const text = turn.text;

    // Parse the control markers into the structured { kind, ... } contract while
    // keeping the legacy `text` (with markers intact) for back-compat.
    const clarifyMatch = text.match(/<<<CLARIFY>>>([\s\S]*?)<<<END_CLARIFY>>>/);
    const planMatch = text.match(/<<<TASK_PLAN>>>([\s\S]*?)<<<END_TASK_PLAN>>>/);

    if (clarifyMatch) {
      let questions: any[] = [];
      try { questions = JSON.parse(clarifyMatch[1].trim()); } catch { /* malformed */ }
      return res.json({ kind: 'clarify', text, questions, groundingSources });
    }
    if (planMatch) {
      let plan: any[] = [];
      try {
        const raw = JSON.parse(planMatch[1].trim());
        // Normalize legacy snake_case plan into the Assignment shape used by the UI.
        plan = raw.map((p: any) => ({
          agentId: p.agentId || p.agent_id,
          task: p.task,
          branchName: p.branchName || p.branch_name || `feat/${p.agentId || p.agent_id}`,
          skillLoadout: p.skillLoadout || p.skill_loadout || [],
        }));
      } catch { /* malformed */ }
      return res.json({ kind: 'plan', text, plan, groundingSources });
    }
    res.json({ kind: 'message', text, groundingSources });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Branch status (T6) ---
app.get('/api/branch-status', async (req, res) => {
  const { workspacePath, branches } = req.query as any;
  if (!workspacePath || !branches) return res.status(400).json({ error: 'Missing params' });

  const branchList: string[] = JSON.parse(branches);
  const results: Record<string, { commits: number; files: number; ahead: number }> = {};

  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) return res.json({ branches: {} });
    const base = await getBaseBranch(git);

    for (const branch of branchList) {
      try {
        // Commits on this branch not on the base
        const log = await git.log({ from: base, to: branch });
        const diff = await git.diffSummary([`${base}...${branch}`]);
        results[branch] = {
          commits: log.total,
          files: diff.files.length,
          ahead: log.total,
        };
      } catch {
        results[branch] = { commits: 0, files: 0, ahead: 0 };
      }
    }
    res.json({ branches: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pick the integration base branch: prefer main, then master, else first local branch.
// (branch-status/reviewer used to hardcode 'main', which broke on 'master' repos.)
async function getBaseBranch(git: ReturnType<typeof simpleGit>): Promise<string> {
  const b = await git.branchLocal();
  if (b.all.includes('main')) return 'main';
  if (b.all.includes('master')) return 'master';
  return b.all[0] || 'main';
}

// --- Branch diff (S3: CEO sees exactly what the worker wrote on the branch) ---
app.get('/api/diff', async (req, res) => {
  let { workspacePath, branch } = req.query as any;
  if (!workspacePath || !branch) return res.status(400).json({ error: 'Missing workspacePath or branch' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) return res.json({ diff: '', base: '', branch, files: [] });
    const base = await getBaseBranch(git);
    // Worktree changes on the branch that aren't committed yet still matter for review,
    // so diff base...branch (committed) — the worker commits, or we show uncommitted too.
    let diff = '';
    let files: { file: string; insertions: number; deletions: number }[] = [];
    try {
      diff = await git.diff([`${base}...${branch}`]);
      const sum = await git.diffSummary([`${base}...${branch}`]);
      files = sum.files.map((f: any) => ({ file: f.file, insertions: f.insertions ?? 0, deletions: f.deletions ?? 0 }));
    } catch {}
    res.json({ base, branch, diff: diff || '(no committed changes vs ' + base + ')', files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Merge (S4: CEO accepts → merge the branch into the base locally) ---
app.post('/api/merge', async (req, res) => {
  let { workspacePath, branch } = req.body || {};
  if (!workspacePath || !branch) return res.status(400).json({ error: 'Missing workspacePath or branch' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) return res.status(400).json({ error: 'Not a git repository' });
    const base = await getBaseBranch(git);
    await git.checkout(base);
    try {
      const summary = await git.merge([branch, '--no-ff', '-m', `Merge ${branch} into ${base} (accepted by CEO)`]);
      res.json({ ok: true, base, merged: branch, sha: (summary as any)?.result || '' });
    } catch (mergeErr: any) {
      // Conflict or failure — abort so the repo is left clean, report back.
      try { await git.merge(['--abort']); } catch {}
      res.status(409).json({ error: `Merge failed (likely a conflict): ${mergeErr.message}`, base, branch });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Nudge a worker (T3) ---
// Continues the panel's existing ChatSession after the main execution loop.
app.post('/api/panel/:panelId/nudge', async (req, res) => {
  const { panelId } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  if (activePanels.has(panelId)) {
    return res.json({ text: 'Worker is currently executing — approve or deny the pending action first.' });
  }

  const panel = panelSessions.get(panelId);
  if (!panel) return res.status(404).json({ error: 'No session found. Start the worker first.' });

  try {
    const turn = await panel.session.sendMessage(message);
    if (turn.toolCalls.length > 0) {
      // Worker wants to take action — surface this but don't auto-execute
      return res.json({
        text: (turn.text || 'Worker wants to take action.') + '\n> [TOOL REQUEST] Start the worker again to execute.',
      });
    }
    res.json({ text: turn.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Init project ---
app.post('/api/init-project', (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'Missing projectPath' });
  try {
    const acDir = path.join(projectPath, '.chaperone');
    fs.mkdirSync(acDir, { recursive: true });
    const starters: Record<string, string> = {
      'PRD.md': '# Product Requirements Document\n\n_Created by Chaperone. PM will populate this as you brief missions._\n',
      'SOP.md': '# Standard Operating Procedure\n\n_Created by Chaperone. PM will populate this with team norms._\n',
      'Dev log.md': '# Development Log\n\n_Created by Chaperone. Reviewer reports will be appended here after each archived mission._\n',
    };
    for (const [name, content] of Object.entries(starters)) {
      const p = path.join(acDir, name);
      if (!fs.existsSync(p)) fs.writeFileSync(p, content);
    }
    res.json({ success: true, path: acDir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Add skill ---
app.post('/api/add-skill', (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Missing params' });
  try {
    const slug = name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    const skillDir = path.join(getSkillsDir(), slug);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    res.json({ success: true, name: slug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Create PR (T8) ---
app.post('/api/create-pr', (req, res) => {
  const { workspacePath, branch, title, body } = req.body;
  if (!workspacePath || !branch || !title) {
    return res.status(400).json({ error: 'Missing params' });
  }
  execFile('gh', ['pr', 'create', '-B', 'main', '-H', branch, '--title', title, '--body', body || ''],
    { cwd: workspacePath },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: stderr.trim() || error.message });
      const url = stdout.trim().split('\n').pop() || '';
      res.json({ url });
    }
  );
});

// --- Reviewer (T7) ---
app.get('/api/reviewer', async (req, res) => {
  const { workspacePath, branches, tasks } = req.query as any;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type: string, data: any) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  const apiKey = getApiKey();
  if (!apiKey) { send('log', { log: '[ERROR] API key missing.' }); return res.end(); }
  if (!workspacePath || !branches) { send('log', { log: '[ERROR] Missing params.' }); return res.end(); }

  const branchList: string[] = JSON.parse(branches);
  const taskMap: Record<string, string> = tasks ? JSON.parse(tasks) : {};

  send('log', { log: `[REVIEWER] Starting cross-branch review — ${branchList.length} branch(es)…` });

  const diffs: Record<string, string> = {};
  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) {
      send('log', { log: '[ERROR] Workspace is not a git repository.' });
      return res.end();
    }
    const base = await getBaseBranch(git);
    for (const branch of branchList) {
      try {
        send('log', { log: `[REVIEWER] Reading diff for ${branch}…` });
        const diff = await git.diff([`${base}...${branch}`]);
        diffs[branch] = diff?.trim() || `(no changes vs ${base})`;
      } catch (e: any) {
        diffs[branch] = `(diff unavailable: ${e.message})`;
        send('log', { log: `[REVIEWER] Warning: ${branch} diff failed` });
      }
    }
  } catch (err: any) {
    send('log', { log: `[ERROR] git error: ${err.message}` });
    return res.end();
  }

  const diffSections = branchList.map(b =>
    `=== Branch: ${b} ===\nTask: ${taskMap[b] || 'Unknown'}\n\n${diffs[b]}`
  ).join('\n\n---\n\n');

  const prompt = `You are a senior code reviewer for a multi-agent development platform.
Review the following git diffs from parallel development branches.

${diffSections}

Return ONLY a JSON array of review annotations. No prose before or after.
Each entry must match this schema exactly:
{
  "type": "bug" | "note" | "bloat" | "missing",
  "branch": "<branch-name>",
  "file": "<file-path or null>",
  "line": "<line number or range, or null>",
  "message": "<concise actionable annotation, max 120 chars>"
}

Type meanings:
- "bug": logic errors, incorrect behavior, crashes, security issues
- "note": informational observations, style, alternative approaches
- "bloat": dead code, unnecessary complexity, unused imports
- "missing": missing error handling, tests, docs, or core functionality

If a branch has no diff, include one "note" annotation saying so.`;

  send('log', { log: '[REVIEWER] Analyzing with Gemini…' });

  try {
    const { text } = await getProvider('pm-plan').generateOnce(prompt);

    send('log', { log: '[REVIEWER] Analysis complete. Parsing annotations…' });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      send('log', { log: '[ERROR] Could not parse review output. Raw: ' + text.substring(0, 200) });
      return res.end();
    }
    const annotations = JSON.parse(jsonMatch[0]);
    send('annotations', { annotations });
    send('log', { log: `[REVIEWER] Done — ${annotations.length} annotation(s).` });
  } catch (err: any) {
    send('log', { log: `[ERROR] Review failed: ${err.message}` });
  }
  res.end();
});

// --- Project docs (PRD / SOP / Dev log) — read REAL files from the project ---
const DOC_CANDIDATES: Record<string, string[]> = {
  PRD:    ['.chaperone/PRD.md', 'PRD.md', 'docs/PRD.md', 'prd.md'],
  SOP:    ['.chaperone/SOP.md', 'SOP.md', 'docs/SOP.md'],
  DevLog: ['.chaperone/Dev log.md', 'Dev log.md', 'docs/Dev log.md', 'CHANGELOG.md', 'docs/CHANGELOG.md'],
};
const canonicalDoc = (name: string) => name === 'DevLog' ? 'Dev log.md' : `${name}.md`;

app.get('/api/doc', (req, res) => {
  const { workspacePath, name } = req.query as any;
  if (!workspacePath || !DOC_CANDIDATES[name]) return res.status(400).json({ error: 'Missing workspacePath or bad name' });
  for (const rel of DOC_CANDIDATES[name]) {
    const p = path.join(workspacePath, rel);
    if (fs.existsSync(p)) {
      try { return res.json({ found: true, path: rel, content: fs.readFileSync(p, 'utf-8') }); } catch {}
    }
  }
  res.json({ found: false, path: `.chaperone/${canonicalDoc(name)}`, content: '' });
});

app.put('/api/doc', (req, res) => {
  const { workspacePath, name, content } = req.body;
  if (!workspacePath || !DOC_CANDIDATES[name]) return res.status(400).json({ error: 'Missing workspacePath or bad name' });
  try {
    const dir = path.join(workspacePath, '.chaperone');
    fs.mkdirSync(dir, { recursive: true });
    const rel = `.chaperone/${canonicalDoc(name)}`;
    fs.writeFileSync(path.join(workspacePath, rel), content ?? '');
    res.json({ ok: true, path: rel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Project review — PM actually READS key files and summarizes (no guessing) ---
app.post('/api/project-review', async (req, res) => {
  let { workspacePath } = req.body;
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });
  try {
    const readMaybe = (rels: string[], max = 4000) => {
      for (const rel of rels) {
        const p = path.join(workspacePath, rel);
        try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').slice(0, max); } catch {}
      }
      return '';
    };
    const readme = readMaybe(['README.md', 'readme.md', 'docs/README.md']);
    const pkg = readMaybe(['package.json'], 1500);
    let topLevel: string[] = [];
    try { topLevel = fs.readdirSync(workspacePath).filter(f => !['node_modules', '.git', 'dist', '.next', '.chaperone'].includes(f)); } catch {}
    let docs: string[] = [];
    try { const d = path.join(workspacePath, 'docs'); if (fs.existsSync(d)) docs = fs.readdirSync(d).slice(0, 30); } catch {}
    const prompt = `You are the PM. The user just pointed you at this project and asked you to get up to speed. Using ONLY the real files below, brief them.

Format your reply as short, scannable Markdown — NOT one long paragraph. Use a few bold mini-headings with 1-2 sentences each, e.g.:
**What it is** — …
**Tech stack** — …
**Current state** — …
Keep it tight. Do NOT invent features or tech — if something isn't evident from these files, say so. Reply in the user's language if they wrote in a non-English language.

=== Top-level entries ===
${topLevel.join(', ') || '(none)'}

=== README ===
${readme || '(no README found)'}

=== package.json ===
${pkg || '(no package.json found)'}

=== docs/ files ===
${docs.join(', ') || '(no docs/ folder)'}`;
    const { text: summary } = await getProvider('reviewer').generateOnce(prompt);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PM Parallelization Plan (S1 of the PM-model slice) ---
// The PM reads the REAL project (file tree + key docs) and produces a structured
// plan: golden path, foundation files, volatility, recommended gear, read-only audit
// allocation. Output must reference real files so the CEO can verify it isn't canned.
// Operating model: docs/PM_OPERATING_MODEL.md.

const TREE_IGNORE = new Set([
  'node_modules', '.git', 'dist', '.next', '.chaperone', 'build', 'out',
  'Library', 'Temp', 'Logs', '.vite', 'coverage', '.turbo', '.cache',
]);

/** Bounded recursive file listing (relative, forward-slashed) so the PM can name real files. */
function walkTree(root: string, maxFiles = 400, maxDepth = 5): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (out.length >= maxFiles || depth > maxDepth) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      if (e.isDirectory()) {
        if (TREE_IGNORE.has(e.name) || e.name.startsWith('.')) continue;
        walk(path.join(dir, e.name), depth + 1);
      } else {
        out.push(path.relative(root, path.join(dir, e.name)).replace(/\\/g, '/'));
      }
    }
  };
  walk(root, 0);
  return out;
}

// Concise embedded operating model — travels with the PM (not read from the target
// workspace), per the "Chaperone ships its own copy" decision. Mirrors PM_OPERATING_MODEL.md.
const PM_MODEL_PREAMBLE = `You are the PM (lead agent) of Chaperone, a multi-agent dev platform. The human is the CEO and makes the final call. Plan by this operating model:
- Work is organized as vertical slices. Find the GOLDEN PATH: the serial chain of required slices with HARD dependencies — they cannot be built in parallel because they share foundation (auth, data model, routing, shared state, API client, core pages). Separate these from beta/launch SUPPORT slices.
- FOUNDATION FILES = real files multiple slices must touch (schema/migrations, routing, shared state, API client, shared components, core pages/data flow, backend contracts). Name the REAL ones from the file tree.
- FOUNDATION VOLATILITY = how much those files are still changing. High if the active path spans many of them or they look unstable/early.
- GEAR: L1 = read-only audit parallel ONLY (foundation unknown / volatility High). L2 = limited writes within ONE active slice, split by layer (only after interface contracts locked). L3 = multi-slice / multi-worktree parallel (only when foundation frozen / volatility Low). For an early or unstable project, default to L1.
- Before any multi-agent WRITING, first dispatch READ-ONLY auditors that declare what they will read and report blockers; the PM then builds a conflict map. Do not jump to writing code.`;

app.post('/api/pm/plan', async (req, res) => {
  let { workspacePath, goal } = req.body || {};
  if (!workspacePath || !goal) return res.status(400).json({ error: 'Missing workspacePath or goal' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  try {
    const readMaybe = (rels: string[], max = 3500) => {
      for (const rel of rels) {
        const p = path.join(workspacePath, rel);
        try { if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').slice(0, max); } catch {}
      }
      return '';
    };
    const readme = readMaybe(['README.md', 'readme.md', 'docs/README.md']);
    const pkg = readMaybe(['package.json'], 1200);
    const mvp = readMaybe(['docs/MVP.md', '.chaperone/MVP.md', 'MVP.md'], 2500);
    const progress = readMaybe(['docs/PROGRESS.md', '.chaperone/PROGRESS.md', 'PROGRESS.md'], 1500);
    const tree = walkTree(workspacePath);

    const nonEnglish = /[一-鿿぀-ヿ가-힯]/.test(goal || '');
    const langDirective = nonEnglish
      ? `\n\nLANGUAGE: write every human-readable string VALUE (names, reasons, "why", produces, nextStep) in the CEO's own language (the language of the goal), NOT English. JSON keys stay in English.`
      : '';

    const prompt = `${PM_MODEL_PREAMBLE}

The CEO's goal: "${goal}"

=== Project file tree (real paths, truncated) ===
${tree.join('\n') || '(empty)'}

=== README ===
${readme || '(none)'}

=== package.json ===
${pkg || '(none)'}

=== docs/MVP.md (if present) ===
${mvp || '(none)'}

=== docs/PROGRESS.md (if present) ===
${progress || '(none)'}

Using ONLY the real files above, output a Parallelization Plan as STRICT JSON (no prose before/after, no markdown fences). Reference REAL file paths from the tree — never invent files. Schema:
{
  "projectName": "<real product name from README/package.json>",
  "summary": "<1-2 sentences: what this project is + current state>",
  "goldenPath": [ { "id": "S1", "name": "<slice>", "dependsOn": "<id or 'none'>" } ],
  "supportSlices": [ { "id": "S5", "name": "<slice>", "category": "beta" | "launch" } ],
  "foundationFiles": [ { "path": "<real path from tree>", "why": "<role>" } ],
  "foundationVolatility": "High" | "Medium" | "Low",
  "recommendedGear": "L1" | "L2" | "L3",
  "gearReason": "<why this gear now>",
  "readOnlyAudits": [ { "agent": "<name>", "reads": ["<real path>"], "produces": "<deliverable>" } ],
  "notParallelYet": [ "<reason multi-agent writing is unsafe now>" ],
  "nextStep": "<the single concrete next action>"
}${langDirective}`;

    const { text: raw } = await getProvider('pm-plan').generateOnce(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'PM did not return JSON', raw: raw.slice(0, 400) });
    let plan: any;
    try { plan = JSON.parse(jsonMatch[0]); }
    catch (e: any) { return res.status(502).json({ error: 'PM JSON parse failed', raw: jsonMatch[0].slice(0, 400) }); }

    const record = store.savePmPlan(workspacePath, {
      goal, createdAt: new Date().toISOString(), model: getProvider().modelLabel, plan,
    });
    res.json(record);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pm/plan', (req, res) => {
  let ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  if (ws.startsWith('~')) ws = path.join(os.homedir(), ws.slice(1));
  try { res.json(store.getPmPlan(ws) || { plan: null }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- PM "go over my project" — AGENTIC, read-only ---
// The model drives: we hand it read-only tools (list_files / read_file) and let it
// explore the repo itself, like Claude Code / Codex would — no hand-fed file blob, no
// extra restrictions. We only frame it as the PM and keep it read-only (the traffic
// rules); the steering wheel is the model's. Returns its own-voice summary + the files
// it chose to read (proof of agency).
const EXPLORE_TOOLS = [
  { name: 'list_files', description: 'List the project file tree (relative paths). Call this first to see what exists.', parameters: { type: 'OBJECT', properties: {}, required: [] } },
  { name: 'read_file', description: 'Read a file by its relative path (from list_files).', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
];

/** Resolve `~`, verify the path and the API key. Returns an error string, or null. */
function checkWorkspace(workspacePath: string): string | null {
  if (!workspacePath) return 'Missing workspacePath';
  if (!getApiKey()) return 'API key missing';
  if (!fs.existsSync(workspacePath)) return `Path not found: ${workspacePath}`;
  return null;
}

const expandHome = (p: string) =>
  p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;

function languageName(langCode: string): string {
  const c = String(langCode || '').toLowerCase();
  if (/zh|cn|[一-鿿]/.test(c)) return '简体中文 (Simplified Chinese)';
  if (/ja|[぀-ヿ]/.test(c)) return '日本語 (Japanese)';
  if (/ko|[가-힯]/.test(c)) return '한국어 (Korean)';
  return '';
}

/**
 * Run the read-only exploration loop: the model drives, calling list_files and
 * read_file until it is ready to answer. Shared by every "PM looks at the repo"
 * endpoint so they all explore the same way.
 */
async function runExploreLoop(system: string, kickoff: string, workspacePath: string) {
  const tree = walkTree(workspacePath, 600, 6);
  const filesRead: string[] = [];

  const session = getProvider('explore').startChat({ system, tools: EXPLORE_TOOLS });
  let turn = await session.sendMessage(kickoff);

  for (let step = 0; step < 16; step++) {
    if (!turn.toolCalls || turn.toolCalls.length === 0) break;
    const results = turn.toolCalls.map(call => {
      if (call.name === 'list_files') return { name: call.name, result: tree.join('\n') };
      if (call.name === 'read_file') {
        const rel = String((call.args as any)?.path || '');
        filesRead.push(rel);
        return { name: call.name, result: readFile(rel, workspacePath).slice(0, 6000) };
      }
      return { name: call.name, result: '[ERROR] unknown tool' };
    });
    turn = await session.sendToolResults(results);
  }

  return { text: turn.text || '', filesRead: [...new Set(filesRead)] };
}

/** Pull a `<<<TAG>>> … <<<END_TAG>>>` block out of model output. */
function extractBlock(text: string, tag: string): { body: string | null; rest: string } {
  const re = new RegExp(`<<<${tag}>>>([\\s\\S]*?)<<<END_${tag}>>>`);
  const m = text.match(re);
  return { body: m ? m[1].trim() : null, rest: text.replace(re, '').trim() };
}

app.post('/api/pm/explore', async (req, res) => {
  const workspacePath = expandHome(req.body?.workspacePath);
  const problem = checkWorkspace(workspacePath);
  if (problem) return res.status(400).json({ error: problem });

  const langName = languageName(req.body?.lang);
  // Opt-in: the onboarding scan asks for follow-up options, the main "go over my
  // project" button does not.
  const wantReplies = !!req.body?.wantReplies;

  const system = `You are the PM (lead agent) of Chaperone for THIS project. The CEO just asked you to get up to speed on it.

You have READ-ONLY tools — actually USE them to explore, the way a capable engineer would: call list_files to see what exists, then read the files that reveal what this project is (README, package.json, docs/*, key source/config). You decide what to open — read whatever you need before answering. Do not guess about something you could just read.

When you're done exploring, tell the CEO — in their own language — what this project actually IS (purpose/product), its tech stack, and its current state. Format as short, scannable Markdown with a few bold mini-headings. Be specific and grounded in what you read; if something genuinely isn't in the files, say so.${langName ? `\n\nIMPORTANT: Write your entire final briefing in ${langName}. Not English.` : ''}${
    wantReplies
      ? `

After the briefing, add 2-4 replies the CEO might plausibly send you next, one per line, wrapped exactly like this:
<<<REPLIES>>>
first option
second option|action_name
<<<END_REPLIES>>>

Rules for that block: these are the CEO's words, not yours — write them in first person, short, as something they would actually type. Base them on what you FOUND, not on a template: only offer to write a PRD.md / SOP.md / Dev log.md if the project genuinely lacks them, and if it already has them, offer whatever the real next step is instead.

This app can carry out two things directly. If — and only if — a reply you wrote means one of them, append "|" and the action name to that line. Otherwise leave the line bare and it becomes an ordinary message to you.
- draft_docs — you draft the missing memory documents for the CEO to approve
- start_working — skip document setup and go straight to briefing a mission`
      : ''
  }`;

  try {
    const { text, filesRead } = await runExploreLoop(
      system,
      'Start exploring this project now using your tools, then give me your briefing.',
      workspacePath,
    );

    // "text" or "text|action". The action vocabulary is ours (it is what the app
    // can actually carry out); which reply maps to which is the model's call.
    const ACTIONS = new Set(['draft_docs', 'start_working']);
    const { body, rest } = extractBlock(text, 'REPLIES');
    const suggestedReplies = (body ? body.split('\n') : [])
      .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
      .map(line => {
        const cut = line.lastIndexOf('|');
        if (cut === -1) return { text: line, action: null as string | null };
        const action = line.slice(cut + 1).trim();
        return ACTIONS.has(action)
          ? { text: line.slice(0, cut).trim(), action }
          : { text: line, action: null };
      })
      .filter(r => r.text)
      .slice(0, 4);

    res.json({
      summary: rest || '(no summary returned)',
      suggestedReplies,
      filesRead,
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- PM drafts the memory docs — AGENTIC, read-only until the CEO approves ---
// The onboarding screen used to SHOW a hardcoded description of each doc, and
// "approving" it wrote nothing: /api/init-project later created the same generic
// placeholder regardless of what the CEO saw. Here the model actually reads the
// project and writes real drafts; nothing lands on disk until the CEO approves
// each one (the frontend then PUTs it to /api/doc).
app.post('/api/pm/draft-docs', async (req, res) => {
  const workspacePath = expandHome(req.body?.workspacePath);
  const problem = checkWorkspace(workspacePath);
  if (problem) return res.status(400).json({ error: problem });

  const KNOWN_DOCS = ['PRD.md', 'SOP.md', 'Dev log.md'];
  // An explicit list pins what to draft; omitting it leaves the choice to the
  // model, which has just read the repo and knows which of these actually exist.
  const requested: string[] = Array.isArray(req.body?.docs) && req.body.docs.length
    ? req.body.docs.map(String).filter((d: string) => KNOWN_DOCS.includes(d))
    : [];
  const langName = languageName(req.body?.lang);

  const system = `You are the PM (lead agent) of Chaperone for THIS project. The CEO asked you to draft the long-term memory documents this project is missing.

First, explore with your READ-ONLY tools — list_files, then read what tells you what this project is (README, package.json, docs/*, key source and config). Do not guess about anything you could read.

${requested.length
    ? `Then draft ONLY these documents: ${requested.join(', ')}.`
    : `Then decide which of PRD.md, SOP.md and Dev log.md this project is actually missing — check the root, docs/ and .chaperone/ before deciding — and draft only those. If it already has all three, draft nothing and say so in one line.`}

Ground every draft in what you actually read. A PRD states what THIS product is, its goals, non-goals, stack and open questions — not a generic template. An SOP states the conventions this repo actually follows (branch naming, commit format, test and style conventions) as evidenced by its git history, config files and existing code. A Dev log starts effectively empty; say so rather than inventing history.

Return each document in its own block, using the exact file name as the tag:
<<<DOC:PRD.md>>>
# ...markdown body...
<<<END_DOC>>>

Output nothing outside those blocks.${langName ? `\n\nIMPORTANT: Write the documents in ${langName}.` : ''}`;

  try {
    const { text, filesRead } = await runExploreLoop(
      system,
      requested.length
        ? `Explore this project now, then draft: ${requested.join(', ')}.`
        : 'Explore this project now, then draft whichever memory documents it is missing.',
      workspacePath,
    );

    const drafts: { name: string; content: string }[] = [];
    for (const name of (requested.length ? requested : KNOWN_DOCS)) {
      const re = new RegExp(`<<<DOC:${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>>>([\\s\\S]*?)<<<END_DOC>>>`);
      const m = text.match(re);
      if (m && m[1].trim()) drafts.push({ name, content: m[1].trim() });
    }

    // No drafts is a legitimate outcome when the project already has all three —
    // the model says so instead. Report that rather than treating it as failure.
    res.json({
      drafts,
      note: drafts.length === 0 ? (text.trim().slice(0, 400) || 'Nothing to draft.') : '',
      filesRead,
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- PM "check progress" — AGENTIC, read-only ---
// Reads the project's REAL progress sources (docs/PROGRESS.md, docs/MVP.md, status docs)
// and reports in its own voice. Replaces the old deterministic JSON render that showed a
// generic seed. Model drives; we only frame it + keep it read-only.
app.post('/api/pm/progress-report', async (req, res) => {
  let { workspacePath } = req.body || {};
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  const tree = walkTree(workspacePath, 600, 6);
  const filesRead: string[] = [];
  const langCode = String(req.body?.lang || '').toLowerCase();
  const langName =
    /zh|cn|[一-鿿]/.test(langCode) ? '简体中文 (Simplified Chinese)' :
    /ja|[぀-ヿ]/.test(langCode)    ? '日本語 (Japanese)' :
    /ko|[가-힯]/.test(langCode)    ? '한국어 (Korean)' : '';

  const system = `You are the PM (lead agent) for THIS project. The CEO is asking where the project stands right now.

You have READ-ONLY tools — USE them. Read the project's REAL progress sources: docs/PROGRESS.md, docs/MVP.md, docs/ACCEPTANCE.md, docs/PROJECT_STATE.md, docs/TODO.md, docs/PLAN.md, or any status/roadmap docs you find. Read whatever you need before answering — do not guess.

Then tell the CEO, grounded in what you actually read:
- What's DONE (which slices/milestones are accepted or complete)
- What's IN PROGRESS right now
- What's NEXT / the immediate next step
- Any blockers or risks

If this project has NO real progress tracking (no PROGRESS.md / MVP.md / status docs), say so honestly and offer to build the three-piece set (MVP.md / PROGRESS.md / ACCEPTANCE.md) by reading the project — do NOT invent progress.

Format as short scannable Markdown with bold mini-headings. Be specific — cite real file names and real slice/milestone names from the docs. End with ONE natural follow-up question about what the CEO wants to do next.${langName ? `\n\nIMPORTANT: Write your entire reply in ${langName}. Not English.` : ''}`;

  try {
    const session = getProvider('draft-docs').startChat({ system, tools: EXPLORE_TOOLS });
    let turn = await session.sendMessage('Check where this project stands now using your tools, then report to me.');

    for (let step = 0; step < 16; step++) {
      if (!turn.toolCalls || turn.toolCalls.length === 0) break;
      const results = turn.toolCalls.map(call => {
        if (call.name === 'list_files') return { name: call.name, result: tree.join('\n') };
        if (call.name === 'read_file') {
          const rel = String((call.args as any)?.path || '');
          filesRead.push(rel);
          return { name: call.name, result: readFile(rel, workspacePath).slice(0, 6000) };
        }
        return { name: call.name, result: '[ERROR] unknown tool' };
      });
      turn = await session.sendToolResults(results);
    }

    res.json({
      summary: turn.text || '(no summary returned)',
      filesRead: [...new Set(filesRead)],
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- PM checkpoint — persist the conversation's decisions/progress to docs ---
// So clearing a conversation is SAFE: the PM's real memory lives in durable docs, not
// the transcript. The PM reviews the chat, appends real DECISIONS to docs/DECISIONS.md
// and a timestamped progress note to docs/PROGRESS.md. Read-then-append (never destroys).
const CHECKPOINT_TOOLS = [
  { name: 'read_file', description: 'Read a doc to match its existing format before appending.', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
  { name: 'append_doc', description: 'Append content to a docs/*.md file (created if missing). Use for DECISIONS.md / PROGRESS.md.', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['path', 'content'] } },
];

app.post('/api/pm/checkpoint', async (req, res) => {
  let { workspacePath, history } = req.body || {};
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  const transcript = Array.isArray(history)
    ? history.map((m: any) => `${m.role === 'user' ? 'CEO' : 'PM'}: ${m.content || ''}`).join('\n\n')
    : String(req.body?.transcript || '');
  const langCode = String(req.body?.lang || '').toLowerCase();
  const langName =
    /zh|cn|[一-鿿]/.test(langCode) ? '简体中文 (Simplified Chinese)' :
    /ja|[぀-ヿ]/.test(langCode)    ? '日本語 (Japanese)' :
    /ko|[가-힯]/.test(langCode)    ? '한국어 (Korean)' : '';
  const wrote: string[] = [];
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const system = `You are the PM. The CEO is about to CLEAR this conversation. Before it's gone, PRESERVE anything important so nothing is lost — because your real memory lives in the project docs, not the chat.

Review the conversation. Then:
1. For each real DECISION reached (a choice, a direction, a tradeoff settled), append it to docs/DECISIONS.md. First read_file docs/DECISIONS.md to match its format; if it doesn't exist, create a sensible entry with today's date (${now}).
2. If real PROGRESS/state changed (a slice advanced, something got built/verified, a blocker found), append a short timestamped note to docs/PROGRESS.md (read it first to match its Timestamped Log format; use "${now} — by PM (checkpoint)").

Rules:
- Only record things that ACTUALLY matter. Skip small talk, questions, and things already in the docs.
- If nothing important was decided or changed, write NOTHING and just say so.
- Never rewrite or delete existing content — append only.

When done, tell the CEO in a short bullet list exactly what you saved and to which files (so they can clear with confidence).${langName ? `\n\nWrite your final reply in ${langName}.` : ''}`;

  try {
    const session = getProvider('progress-report').startChat({ system, tools: CHECKPOINT_TOOLS });
    let turn = await session.sendMessage(`Here is the conversation to checkpoint:\n\n${transcript.slice(0, 24000)}\n\nPreserve what matters now, then report what you saved.`);

    for (let step = 0; step < 12; step++) {
      if (!turn.toolCalls || turn.toolCalls.length === 0) break;
      const results = turn.toolCalls.map(call => {
        if (call.name === 'read_file') {
          const rel = String((call.args as any)?.path || '');
          return { name: call.name, result: readFile(rel, workspacePath).slice(0, 6000) };
        }
        if (call.name === 'append_doc') {
          const rel = String((call.args as any)?.path || '');
          const content = String((call.args as any)?.content || '');
          const r = appendDoc(rel, content, workspacePath);
          if (r.startsWith('[OK]') && !wrote.includes(rel)) wrote.push(rel);
          return { name: call.name, result: r };
        }
        return { name: call.name, result: '[ERROR] unknown tool' };
      });
      turn = await session.sendToolResults(results);
    }

    res.json({
      summary: turn.text || '(nothing to save)',
      wrote,
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Progress Map (structured source of truth for the global board) ---
app.get('/api/pm/progress', (req, res) => {
  let ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  if (ws.startsWith('~')) ws = path.join(os.homedir(), ws.slice(1));
  try { res.json(store.getProgress(ws)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/pm/progress', (req, res) => {
  let { workspacePath, ...patch } = req.body || {};
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  try { res.json(store.saveProgress(workspacePath, patch)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- PM L1 Audit — multi-agent read-only fan-out (S2) ---
// Phase 1: PM decides how many auditors + their domains (model chooses, not hardcoded).
// Phase 2: Run each auditor in parallel — each gets the same read-only tools and its own focus.
// Phase 3: PM consolidates findings → Foundation Files list + CEO Briefing.
app.post('/api/pm/audit', async (req, res) => {
  let { workspacePath } = req.body || {};
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  const tree = walkTree(workspacePath, 600, 6);
  const langCode = String(req.body?.lang || '').toLowerCase();
  const langName =
    /zh|cn|[一-鿿]/.test(langCode) ? '简体中文 (Simplified Chinese)' :
    /ja|[぀-ヿ]/.test(langCode)    ? '日本語 (Japanese)' :
    /ko|[가-힯]/.test(langCode)    ? '한국어 (Korean)' : '';

  const AUDIT_TOOLS = [
    { name: 'list_files', description: 'List the project file tree (relative paths).', parameters: { type: 'OBJECT', properties: {}, required: [] } },
    { name: 'read_file', description: 'Read a file by its relative path.', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
  ];

  try {
    // ── Phase 1: PM decides the audit plan ──────────────────────────────────
    const planSession = getProvider('pm-plan').startChat({
      system: `You are the PM. Plan a read-only L1 audit for this project.

Given the file tree, decide how many read-only auditors to dispatch and what each should focus on.
Respond with ONLY a JSON array — no markdown fences, no explanation:
[
  {"id": "FE-Auditor", "focus": "frontend components, routing, state", "hint": "start with src/"},
  {"id": "BE-Auditor", "focus": "API endpoints, persistence, backend logic", "hint": "start with server/"}
]

Rules:
- 1 to 4 auditors (match project complexity — small project = 1-2, large = 3-4)
- Each auditor covers a distinct non-overlapping domain
- Use role-based ids: FE-Auditor, BE-Auditor, Data-Auditor, Infra-Auditor, etc.`,
      tools: [],
    });

    const planTurn = await planSession.sendMessage(
      `File tree:\n${tree.slice(0, 300).join('\n')}\n\nDecide the audit plan now. JSON only.`
    );

    let auditorSpecs: { id: string; focus: string; hint?: string }[] = [];
    try {
      const jsonMatch = planTurn.text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) auditorSpecs = JSON.parse(jsonMatch[0]);
    } catch {}
    if (!auditorSpecs.length) auditorSpecs = [{ id: 'PM-Auditor', focus: 'full project overview' }];

    // ── Phase 2: Fan-out — all auditors run in parallel ─────────────────────
    const auditorResults = await Promise.all(auditorSpecs.map(async (spec) => {
      const filesRead: string[] = [];
      const session = getProvider('pm-plan').startChat({
        system: `You are ${spec.id}, a read-only L1 auditor. Your focus: ${spec.focus}.

Use your tools to explore the relevant parts of this project. Read the files that matter to your domain.
After exploring, write a concise findings report covering:
- Key files in your domain and their roles
- Current state / health
- Integration points and dependencies on other parts
- Any gaps, risks, or missing pieces

Read-only only — do not suggest changes, just report what you find.`,
        tools: AUDIT_TOOLS,
      });

      let turn = await session.sendMessage(
        `File tree:\n${tree.join('\n')}\n\nStart your audit now.${spec.hint ? ` ${spec.hint}` : ''}`
      );

      for (let step = 0; step < 16; step++) {
        if (!turn.toolCalls || turn.toolCalls.length === 0) break;
        const results = turn.toolCalls.map(call => {
          if (call.name === 'list_files') return { name: call.name, result: tree.join('\n') };
          if (call.name === 'read_file') {
            const rel = String((call.args as any)?.path || '');
            filesRead.push(rel);
            return { name: call.name, result: readFile(rel, workspacePath).slice(0, 6000) };
          }
          return { name: call.name, result: '[ERROR] unknown tool' };
        });
        turn = await session.sendToolResults(results);
      }

      return {
        id: spec.id,
        focus: spec.focus,
        findings: turn.text || '(no findings)',
        filesRead: [...new Set(filesRead)],
      };
    }));

    // ── Phase 3: PM consolidates ─────────────────────────────────────────────
    const allFindings = auditorResults.map(r =>
      `=== ${r.id} (focus: ${r.focus}) ===\nFiles read: ${r.filesRead.join(', ') || '(none)'}\n\n${r.findings}`
    ).join('\n\n---\n\n');

    const consolidateSession = getProvider('pm-plan').startChat({
      system: `${PM_MODEL_PREAMBLE}

You just received read-only audit reports from ${auditorResults.length} auditor(s). Now produce your PM dispatch assessment — NOT a generic tech audit. Apply the operating model above and structure it EXACTLY like this:

**当前阶段判断 / Stage** — What stage is this project really at? Is it a serial Golden Path chain + support slices, or genuinely parallel-safe? Correct any naive "N parallel slices" reading.
**Golden Path + 依赖 / dependencies** — The serial main chain of required slices (S1→S2→…) with their HARD dependencies, and WHY they can't be built in parallel.
**Slice 分类** — Split slices into: core Golden Path · beta/support · launch/commercial.
**Foundation Files + 波动率 / volatility** — List the REAL foundation files (from what the auditors read) and judge volatility High/Medium/Low with reasoning.
**推荐档位 / Recommended gear (L1/L2/L3) + 理由** — Which parallel level is safe NOW, with explicit reasons referencing the gates (are foundation files written into PROGRESS.md? does the active path cross many files? uncommitted changes? Phase 1 declarations done? interface contracts locked?). Early/unstable → L1.
**具体分配 / Concrete allocation** — If L1: which read-only auditors, each with read scope + deliverable. If L2: which layers within the ONE active slice, allowed/forbidden files. Name real files.
**结论 + 下一步 / Recommendation + question** — A clear recommendation (usually: don't widen the battle line; do the safe level first), then ask the CEO ONE concrete question about what they want to do next.

Be specific and grounded — cite real file names and real slice names from the audits. Do not invent files the auditors didn't find.${langName ? `\n\nWrite your entire reply in ${langName}.` : ''}`,
      tools: [],
    });

    const consolidateTurn = await consolidateSession.sendMessage(
      `Auditor reports:\n\n${allFindings}\n\nProduce your PM dispatch assessment now, following the required structure.`
    );

    const totalFilesRead = [...new Set(auditorResults.flatMap(r => r.filesRead))];

    // Update progress: S2 → ai_verified
    try {
      const current = store.getProgress(workspacePath);
      store.saveProgress(workspacePath, {
        slices: current.slices.map(s =>
          s.id === 'S2' ? { ...s, status: 'ai_verified' as const } : s
        ),
      });
    } catch {}

    res.json({
      ceobrief: consolidateTurn.text || '(no briefing)',
      auditors: auditorResults,
      totalFilesRead,
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- S5: L2 layered parallel plan + overlap gate ---
// For ONE active slice, the PM splits work by LAYER (UI / persistence / tests), assigns
// each worker allowed/forbidden files, and defines interface contracts. Then a DETERMINISTIC
// overlap check flags any two workers claiming the same file — the conflict gate that makes
// L2 safe. Model reads real files (agentic) so file ownership is real.
app.post('/api/pm/l2-plan', async (req, res) => {
  let { workspacePath, slice } = req.body || {};
  if (!workspacePath || !slice) return res.status(400).json({ error: 'Missing workspacePath or slice' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing', code: 'no_api_key' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  const tree = walkTree(workspacePath, 600, 6);
  const filesRead: string[] = [];
  const PLAN_TOOLS = [
    { name: 'list_files', description: 'List the project file tree.', parameters: { type: 'OBJECT', properties: {}, required: [] } },
    { name: 'read_file', description: 'Read a file by relative path.', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] } },
  ];

  const system = `${PM_MODEL_PREAMBLE}

The CEO has approved working on ONE active slice at Level 2 (limited concurrent writes within this single slice, split by layer). Use your READ-ONLY tools to read the real files this slice touches, then produce a concrete L2 dispatch.

Respond with ONLY a JSON object (no markdown fences):
{
  "slice": "<the slice>",
  "contracts": [
    { "name": "<function/endpoint>", "input": "<shape>", "output": "<shape>", "owner": "<worker id>", "consumers": ["<worker id>"] }
  ],
  "workers": [
    {
      "id": "FE-Worker", "layer": "UI",
      "task": "<one concrete task>",
      "branchName": "feat/ui-<slug>",
      "allowedFiles": ["<real relative paths this worker MAY edit>"],
      "forbiddenFiles": ["<real paths it must NOT touch>"]
    }
  ]
}

Rules:
- 2 to 4 workers, split by LAYER (UI / persistence / API / tests) — never two workers on the same layer.
- allowedFiles/forbiddenFiles must be REAL paths from the tree. Two workers must NOT share an allowedFile.
- Define interface contracts for anything that crosses a layer boundary (owner writes it, consumers only call it).
- Keep it to this one slice; do not expand scope.`;

  try {
    const session = getProvider().startChat({ system, tools: PLAN_TOOLS });
    let turn = await session.sendMessage(`Active slice: ${slice}\n\nFile tree:\n${tree.slice(0, 400).join('\n')}\n\nRead what you need, then output the L2 dispatch JSON.`);
    for (let step = 0; step < 16; step++) {
      if (!turn.toolCalls || turn.toolCalls.length === 0) break;
      const results = turn.toolCalls.map(call => {
        if (call.name === 'list_files') return { name: call.name, result: tree.join('\n') };
        if (call.name === 'read_file') {
          const rel = String((call.args as any)?.path || '');
          filesRead.push(rel);
          return { name: call.name, result: readFile(rel, workspacePath).slice(0, 6000) };
        }
        return { name: call.name, result: '[ERROR] unknown tool' };
      });
      turn = await session.sendToolResults(results);
    }

    let plan: any = null;
    try { const m = turn.text.match(/\{[\s\S]*\}/); if (m) plan = JSON.parse(m[0]); } catch {}
    if (!plan || !Array.isArray(plan.workers)) {
      return res.json({ error: 'PM did not return a valid L2 plan', raw: turn.text?.slice(0, 500), filesRead: [...new Set(filesRead)] });
    }

    // DETERMINISTIC overlap gate — the conflict check that makes L2 safe (no model).
    const owners: Record<string, string[]> = {};
    for (const w of plan.workers) {
      for (const f of (w.allowedFiles || [])) (owners[f] ||= []).push(w.id || '?');
    }
    const conflicts = Object.entries(owners)
      .filter(([, ws]) => ws.length > 1)
      .map(([file, ws]) => ({ file, workers: ws }));

    res.json({
      plan,
      conflicts,
      safe: conflicts.length === 0,
      filesRead: [...new Set(filesRead)],
      model: getProvider().modelLabel,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- S7: multi-provider selection (runtime switch) ---
app.get('/api/provider', (_req, res) => {
  res.json({
    active: getProviderOverride(),
    current: getProvider().modelLabel,
    available: availableProviders(),
  });
});

// What the models have actually cost. Token counts are measured; the dollar
// figure is an estimate from a rate table the user can correct.
app.get('/api/usage', (req, res) => {
  const scope = req.query.scope as string | undefined;
  res.json({
    total: totals(),
    ...(scope ? { scope: totalsForScope(scope) } : {}),
    byModel: byModel(),
    recent: recentEntries(30),
    rates: { checkedOn: RATES_CHECKED, sources: PRICING_SOURCES, file: ratesFilePath(), values: effectiveRates() },
  });
});

app.post('/api/provider', (req, res) => {
  const id = String(req.body?.provider || '') as ProviderId;
  // Derived from the registry rather than a second hardcoded list — the two drifted
  // once already, which silently made a newly added engine unselectable.
  const valid = ['auto', ...availableProviders().map(p => p.id)];
  if (!valid.includes(id)) return res.status(400).json({ error: 'Invalid provider' });
  if (id !== 'auto') {
    const avail = availableProviders().find(p => p.id === id);
    if (!avail?.ready) return res.status(400).json({ error: `No API key for ${id}` });
  }
  setProviderOverride(id);
  res.json({ ok: true, active: id, current: getProvider().modelLabel });
});

// --- S6 groundwork: git worktree primitive (the L3 mechanism) ---
// Creates/lists/removes worktrees so independent slices can run in isolated checkouts.
// This is ONLY the mechanical primitive — auto-dispatching parallel slices into worktrees
// (true L3) still requires explicit CEO confirmation per the operating model. Verifiable
// deterministically (no model).
const worktreePath = (workspacePath: string, branch: string) => {
  const safe = branch.replace(/[^a-zA-Z0-9._-]/g, '-');
  return path.join(path.dirname(workspacePath), `${path.basename(workspacePath)}--wt--${safe}`);
};

app.post('/api/worktree', async (req, res) => {
  let { workspacePath, branch } = req.body || {};
  if (!workspacePath || !branch) return res.status(400).json({ error: 'Missing workspacePath or branch' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  try {
    const git = simpleGit(workspacePath);
    if (!(await git.checkIsRepo())) return res.status(400).json({ error: 'Not a git repository' });
    const wt = worktreePath(workspacePath, branch);
    if (fs.existsSync(wt)) return res.status(409).json({ error: 'Worktree already exists', path: wt });
    const branches = await git.branchLocal();
    if (branches.all.includes(branch)) {
      await git.raw(['worktree', 'add', wt, branch]);
    } else {
      const base = await getBaseBranch(git);
      await git.raw(['worktree', 'add', '-b', branch, wt, base]);
    }
    res.json({ ok: true, path: wt, branch });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/worktree', async (req, res) => {
  let ws = getWorkspacePath(req);
  if (!ws) return res.status(400).json({ error: 'Missing workspacePath' });
  if (ws.startsWith('~')) ws = path.join(os.homedir(), ws.slice(1));
  try {
    const git = simpleGit(ws);
    if (!(await git.checkIsRepo())) return res.json({ worktrees: [] });
    const raw = await git.raw(['worktree', 'list', '--porcelain']);
    const worktrees: { path: string; branch: string }[] = [];
    let cur: any = {};
    for (const line of raw.split('\n')) {
      if (line.startsWith('worktree ')) cur = { path: line.slice(9) };
      else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace('refs/heads/', '');
      else if (line.trim() === '') { if (cur.path) worktrees.push(cur); cur = {}; }
    }
    if (cur.path) worktrees.push(cur);
    res.json({ worktrees });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/worktree/remove', async (req, res) => {
  let { workspacePath, branch } = req.body || {};
  if (!workspacePath || !branch) return res.status(400).json({ error: 'Missing workspacePath or branch' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  try {
    const git = simpleGit(workspacePath);
    const wt = worktreePath(workspacePath, branch);
    await git.raw(['worktree', 'remove', wt, '--force']);
    res.json({ ok: true, removed: wt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Print the bound port on a line the desktop shell parses. With port 0 the OS
// picks the port, so this is the only way the shell learns where to point the UI.
const server = app.listen(port, () => {
  const addr = server.address();
  const actual = typeof addr === 'object' && addr ? addr.port : port;
  console.log(`Backend at ${actual}`);
  console.log(`CHAPERONE_PORT=${actual}`);
});
