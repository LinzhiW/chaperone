import express from 'express';
import cors from 'cors';
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, Tool } from '@google/generative-ai';
import { exec } from 'child_process';
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

// --- Endpoints ---
app.get('/api/status', (req, res) => res.json({ status: 'online' }));

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
  const { workspacePath, agent, taskName, taskId } = req.query as any;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type: string, data: any) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  const apiKey = getApiKey();
  const modelId = getModelId();
  if (!apiKey) { sendEvent('log', { log: '> [ERROR] API Key missing.' }); return res.end(); }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const tools: any[] = [{
      functionDeclarations: [
        { name: "run_shell", description: "Run shell command", parameters: { type: "OBJECT", properties: { command: { type: "STRING" } }, required: ["command"] } },
        { name: "read_file", description: "Read file", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } }, required: ["path"] } },
        { name: "write_file", description: "Write file", parameters: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } }
      ]
    }];

    const model = genAI.getGenerativeModel({ model: modelId, tools });
    const chat = model.startChat();
    sendEvent('log', { log: `> [SYSTEM] Agent initialized using ${modelId}.` });

    let result = await chat.sendMessage(`You are ${agent}. Mission: ${taskName}. Workspace: ${workspacePath}. Use tools to act. Always explain your intent.`);
    for (let i = 0; i < 10; i++) {
      const response = await result.response;
      const calls = response.functionCalls();
      if (calls && calls.length > 0) {
        for (const call of calls) {
          sendEvent('require_approval', { tool: call.name, args: call.args });
          const approved = await new Promise<boolean>((resolve) => activeMissions.set(taskId, { resolve, toolCall: call }));
          if (!approved) { sendEvent('log', { log: `> [DENIED] Stopping.` }); return res.end(); }
          
          let output = "";
          if (call.name === "run_shell") output = await runShell((call.args as any).command, workspacePath);
          else if (call.name === "read_file") output = readFile((call.args as any).path, workspacePath);
          else if (call.name === "write_file") output = writeFile((call.args as any).path, (call.args as any).content, workspacePath);
          
          sendEvent('log', { log: `> [OUTPUT] ${output.substring(0, 300)}` });
          result = await chat.sendMessage([{ functionResponse: { name: call.name, response: { result: output } } }]);
        }
      } else { 
        const text = response.text();
        if (text) sendEvent('log', { log: `> [FINAL] ${text}` }); 
        break; 
      }
    }
    res.end();
  } catch (err: any) { 
    sendEvent('log', { log: `> [CRITICAL ERROR] ${err.message}` }); 
    res.end(); 
  }
});

app.post('/api/ceo/chat', async (req, res) => {
  const { message, history, files } = req.body;
  const apiKey = getApiKey();
  const modelId = getModelId();
  if (!apiKey) return res.status(400).json({ error: 'Key missing' });

  try {
    const fileList = files && files.length > 0 ? files.join(', ') : "None";
    const systemPrompt = `You are the Project Orchestrator (CEO) of a multi-agent development platform.
Context: Workspace files: ${fileList}.

When the user describes a goal or feature request, produce a structured task plan.
Output the plan as a JSON array wrapped in <<<TASK_PLAN>>> markers, then give a brief explanation.

Example format:
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

Rules:
- Each agent_id must be unique and descriptive (e.g. "frontend-worker", "data-worker")
- branch_name must follow git convention: feat/<short-slug>
- skill_loadout lists relevant skills from the workspace skill pool
- After the markers, explain the plan in 2-3 sentences
- For general conversation (not a goal/feature request), respond normally without the markers`;

    if (shouldUseSearchGrounding(message)) {
      const groundedResponse = await generateContentWithGoogleSearch({
        apiKey,
        model: modelId,
        history: [{ role: 'system', parts: [{ text: systemPrompt }] }, ...history],
        parts: [{ text: message }]
      });
      return res.json({ text: groundedResponse.text, groundingSources: groundedResponse.groundingSources });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId, systemInstruction: systemPrompt });
    const chat = model.startChat({ history: history || [] });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (err: any) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});

app.listen(port, () => console.log(`Backend at ${port}`));
