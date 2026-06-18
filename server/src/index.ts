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
  const { message, history, files, clarifyAnswers } = req.body;
  const apiKey = getApiKey();
  const modelId = getModelId();
  if (!apiKey) return res.status(400).json({ error: 'Key missing' });

  try {
    const fileList = files && files.length > 0 ? files.join(', ') : "None";
    const availableSkills = listSkills().map(s => s.name).join(', ') || 'none loaded';

    // When the frontend re-sends clarify answers, fold them into the prompt and
    // force the PM straight to a plan (no second round of questions).
    const answersBlock = clarifyAnswers && Object.keys(clarifyAnswers).length > 0
      ? `\nThe user has answered your clarifying questions:\n${Object.entries(clarifyAnswers)
          .map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nUse these answers to produce the plan now. Do NOT ask more questions.`
      : '';

    const systemPrompt = `You are the Project Orchestrator (PM) of a multi-agent development platform.
Context: Workspace files: ${fileList}.
Available skills (use these exact names in skill_loadout): ${availableSkills}.

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
- Use CLARIFY at most once per brief; if the user already answered, go straight to PLAN.
- agent_id must be unique and descriptive (e.g. "frontend-worker", "data-worker").
- branch_name must follow git convention: feat/<short-slug>.
- skill_loadout lists relevant skills from the workspace skill pool.${answersBlock}`;

    // Build the model turn (grounded path stays text-only).
    let text: string;
    let groundingSources: any = undefined;
    if (shouldUseSearchGrounding(message)) {
      const groundedResponse = await generateContentWithGoogleSearch({
        apiKey,
        model: modelId,
        history: [{ role: 'system', parts: [{ text: systemPrompt }] }, ...(history || [])],
        parts: [{ text: message }]
      });
      text = groundedResponse.text;
      groundingSources = groundedResponse.groundingSources;
    } else {
      const session = getProvider().startChat({ system: systemPrompt, history: history || [] });
      const turn = await session.sendMessage(message);
      text = turn.text;
    }

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
    const prompt = `You are the PM. The user just pointed you at this project and asked you to get up to speed. Using ONLY the real files below, tell them in 3–5 sentences, plain and specific: what this project actually IS (its purpose/product), the tech stack, and the current state. Do NOT invent features or tech — if something isn't evident from these files, say so.

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

app.listen(port, () => console.log(`Backend at ${port}`));
