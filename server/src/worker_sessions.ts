// What each worker has been told and has done, kept on disk.
//
// A worker's conversation used to live only in the backend's memory, inside the
// provider SDK's chat object. Restart the backend — or let the desktop app close —
// and every worker forgot its task, what it had changed and what you had said to
// it, so "tell the worker that did it to fix it" stopped working the moment the
// process did.
//
// The SDK object cannot be saved, so this keeps a plain-text transcript beside it
// and rebuilds a session from that when the live one is gone. Plain text is the
// one history shape every adapter accepts (see toHistory / toAnthropicHistory /
// histToMessages), which also means a worker can be picked back up on a different
// model than it started on.
//
// Stored under DATA_DIR — per-user app data, outside the project folder — the same
// split Claude Code makes: transcripts are process, not project.

import fs from 'fs';
import path from 'path';

export interface Turn {
  role: 'user' | 'model';
  text: string;
}

export interface WorkerTranscript {
  taskId: string;
  agent: string;
  system: string;
  workspacePath: string;
  branchName?: string;
  turns: Turn[];
}

let dir = '';

export function initWorkerSessions(dataDir: string) {
  dir = path.join(dataDir, 'worker-sessions');
}

// taskId arrives in a URL, so it is never trusted as a filename.
const fileFor = (taskId: string) => path.join(dir, `${String(taskId).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);

export function saveTranscript(t: WorkerTranscript) {
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileFor(t.taskId), JSON.stringify(t, null, 1));
  } catch { /* losing a transcript must not take the worker down with it */ }
}

export function loadTranscript(taskId: string): WorkerTranscript | null {
  if (!dir) return null;
  try { return JSON.parse(fs.readFileSync(fileFor(taskId), 'utf-8')); }
  catch { return null; }
}

/** Append a turn, merging into the previous one when the role repeats — several
 *  adapters reject two consecutive turns from the same side. */
export function appendTurn(t: WorkerTranscript, role: Turn['role'], text: string) {
  const clean = text.trim();
  if (!clean) return;
  const last = t.turns[t.turns.length - 1];
  if (last && last.role === role) last.text += '\n\n' + clean;
  else t.turns.push({ role, text: clean });
}

/**
 * History to rebuild a session from, in the shape the adapters accept. It must end
 * on the model's side, because the next thing sent is a user message; a trailing
 * user turn (a tool result the model never answered) is returned separately so the
 * caller can put it in front of that next message instead of dropping it.
 */
export function historyFor(t: WorkerTranscript): { history: any[]; carry: string } {
  const turns = [...t.turns];
  let carry = '';
  if (turns.length && turns[turns.length - 1].role === 'user') carry = turns.pop()!.text;
  return {
    history: turns.map(x => ({ role: x.role, parts: [{ text: x.text }] })),
    carry,
  };
}
