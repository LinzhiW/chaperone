import express from 'express';
import cors from 'cors';
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getProvider } from './providers';
import { ChatSession } from './providers/types';
import * as store from './persistence';
import { exec, execFile } from 'child_process';
import dotenv from 'dotenv';
import { shouldUseSearchGrounding, generateContentWithGoogleSearch } from './utils/googleSearchGrounding';

dotenv.config();

const app = express();
const port = 3005;

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
// JSON files under <workspacePath>/.canopy/. Missing file = empty list.
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

app.post('/api/config', (req, res) => {
  const { googleKey } = req.body;
  if (googleKey) {
    const envPath = path.join(process.cwd(), '.env');
    fs.writeFileSync(envPath, `GEMINI_API_KEY=${googleKey}\nGEMINI_MODEL=${getModelId()}\n`);
    process.env.GEMINI_API_KEY = googleKey;
    res.json({ success: true, message: 'Key updated' });
  } else {
    res.status(400).json({ error: 'Key required' });
  }
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
  if (!apiKey) { sendEvent('log', { log: '> [ERROR] API Key missing.' }); return res.end(); }

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
    const provider = getProvider();
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
  if (!apiKey) return res.status(400).json({ error: 'Key missing' });

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

2) PLAN — when the brief is CLEAR (or after the user answered your questions),
   output the task plan as a JSON array wrapped in <<<TASK_PLAN>>> markers:
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

3) MESSAGE — for general conversation (not a goal/feature request), just reply
   normally with no markers.

Rules:
- ALWAYS reply in the SAME language the user writes in (e.g. Chinese in -> Chinese out). This applies to all prose, clarifying-question labels/options, and plan explanations.
- Use CLARIFY at most once per brief; if the user already answered, go straight to PLAN.
- agent_id must be unique and descriptive (e.g. "frontend-worker", "data-worker").
- branch_name must follow git convention: feat/<short-slug>.
- skill_loadout lists relevant skills from the workspace skill pool.${answersBlock}${langDirective}`;

    // Always route through the provider. (The old grounded-search path passed an
    // unsupported role:'system' to Gemini, which errored on some messages.)
    const groundingSources: any = undefined;
    const session = getProvider().startChat({ system: systemPrompt, history: history || [] });
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

    for (const branch of branchList) {
      try {
        // Commits on this branch not on main
        const log = await git.log({ from: 'main', to: branch });
        const diff = await git.diffSummary([`main...${branch}`]);
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
    const acDir = path.join(projectPath, '.canopy');
    fs.mkdirSync(acDir, { recursive: true });
    const starters: Record<string, string> = {
      'PRD.md': '# Product Requirements Document\n\n_Created by Canopy. PM will populate this as you brief missions._\n',
      'SOP.md': '# Standard Operating Procedure\n\n_Created by Canopy. PM will populate this with team norms._\n',
      'Dev log.md': '# Development Log\n\n_Created by Canopy. Reviewer reports will be appended here after each archived mission._\n',
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
    for (const branch of branchList) {
      try {
        send('log', { log: `[REVIEWER] Reading diff for ${branch}…` });
        const diff = await git.diff([`main...${branch}`]);
        diffs[branch] = diff?.trim() || '(no changes vs main)';
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
    const text = await getProvider().generateOnce(prompt);

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
  PRD:    ['.canopy/PRD.md', 'PRD.md', 'docs/PRD.md', 'prd.md'],
  SOP:    ['.canopy/SOP.md', 'SOP.md', 'docs/SOP.md'],
  DevLog: ['.canopy/Dev log.md', 'Dev log.md', 'docs/Dev log.md', 'CHANGELOG.md', 'docs/CHANGELOG.md'],
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
  res.json({ found: false, path: `.canopy/${canonicalDoc(name)}`, content: '' });
});

app.put('/api/doc', (req, res) => {
  const { workspacePath, name, content } = req.body;
  if (!workspacePath || !DOC_CANDIDATES[name]) return res.status(400).json({ error: 'Missing workspacePath or bad name' });
  try {
    const dir = path.join(workspacePath, '.canopy');
    fs.mkdirSync(dir, { recursive: true });
    const rel = `.canopy/${canonicalDoc(name)}`;
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
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing' });
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
    try { topLevel = fs.readdirSync(workspacePath).filter(f => !['node_modules', '.git', 'dist', '.next', '.canopy'].includes(f)); } catch {}
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
    const summary = await getProvider().generateOnce(prompt);
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
  'node_modules', '.git', 'dist', '.next', '.canopy', 'build', 'out',
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
// workspace), per the "Canopy ships its own copy" decision. Mirrors PM_OPERATING_MODEL.md.
const PM_MODEL_PREAMBLE = `You are the PM (lead agent) of Canopy, a multi-agent dev platform. The human is the CEO and makes the final call. Plan by this operating model:
- Work is organized as vertical slices. Find the GOLDEN PATH: the serial chain of required slices with HARD dependencies — they cannot be built in parallel because they share foundation (auth, data model, routing, shared state, API client, core pages). Separate these from beta/launch SUPPORT slices.
- FOUNDATION FILES = real files multiple slices must touch (schema/migrations, routing, shared state, API client, shared components, core pages/data flow, backend contracts). Name the REAL ones from the file tree.
- FOUNDATION VOLATILITY = how much those files are still changing. High if the active path spans many of them or they look unstable/early.
- GEAR: L1 = read-only audit parallel ONLY (foundation unknown / volatility High). L2 = limited writes within ONE active slice, split by layer (only after interface contracts locked). L3 = multi-slice / multi-worktree parallel (only when foundation frozen / volatility Low). For an early or unstable project, default to L1.
- Before any multi-agent WRITING, first dispatch READ-ONLY auditors that declare what they will read and report blockers; the PM then builds a conflict map. Do not jump to writing code.`;

app.post('/api/pm/plan', async (req, res) => {
  let { workspacePath, goal } = req.body || {};
  if (!workspacePath || !goal) return res.status(400).json({ error: 'Missing workspacePath or goal' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing' });
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
    const mvp = readMaybe(['docs/MVP.md', '.canopy/MVP.md', 'MVP.md'], 2500);
    const progress = readMaybe(['docs/PROGRESS.md', '.canopy/PROGRESS.md', 'PROGRESS.md'], 1500);
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

    const raw = await getProvider().generateOnce(prompt);
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

app.post('/api/pm/explore', async (req, res) => {
  let { workspacePath } = req.body || {};
  if (!workspacePath) return res.status(400).json({ error: 'Missing workspacePath' });
  if (workspacePath.startsWith('~')) workspacePath = path.join(os.homedir(), workspacePath.slice(1));
  if (!getApiKey()) return res.status(400).json({ error: 'API key missing' });
  if (!fs.existsSync(workspacePath)) return res.status(400).json({ error: `Path not found: ${workspacePath}` });

  const tree = walkTree(workspacePath, 600, 6);
  const filesRead: string[] = [];
  const langCode = String(req.body?.lang || '').toLowerCase();
  const langName =
    /zh|cn|[一-鿿]/.test(langCode) ? '简体中文 (Simplified Chinese)' :
    /ja|[぀-ヿ]/.test(langCode)    ? '日本語 (Japanese)' :
    /ko|[가-힯]/.test(langCode)    ? '한국어 (Korean)' : '';

  const system = `You are the PM (lead agent) of Canopy for THIS project. The CEO just asked you to get up to speed on it.

You have READ-ONLY tools — actually USE them to explore, the way a capable engineer would: call list_files to see what exists, then read the files that reveal what this project is (README, package.json, docs/*, key source/config). You decide what to open — read whatever you need before answering. Do not guess about something you could just read.

When you're done exploring, tell the CEO — in their own language — what this project actually IS (purpose/product), its tech stack, and its current state. Format as short, scannable Markdown with a few bold mini-headings. Be specific and grounded in what you read; if something genuinely isn't in the files, say so.${langName ? `\n\nIMPORTANT: Write your entire final briefing in ${langName}. Not English.` : ''}`;

  try {
    const session = getProvider().startChat({ system, tools: EXPLORE_TOOLS });
    let turn = await session.sendMessage('Start exploring this project now using your tools, then give me your briefing.');

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

app.listen(port, () => console.log(`Backend at ${port}`));
