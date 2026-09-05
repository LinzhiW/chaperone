// Chaperone persistence — JSON files under <projectPath>/.chaperone/.
// Read-on-GET, write-on-mutation. Missing file = empty list.
// Shapes mirror src/chaperoneTypes.ts (Worker / SavedSet / RolePreset).

import fs from 'fs';
import path from 'path';

// --- Shapes (mirror src/chaperoneTypes.ts) ---
export interface Worker {
  id: string;                 // "W1", "W2", …
  displayName: string;
  role: string;
  dept: string;
  branchPrefix: string;
  loadout: string[];
  createdAt: string;
}

export interface SavedSet {
  id: string;
  label: string;
  skillIds: string[];
  owner: 'you' | 'pm';
}

export interface RolePreset {
  id: string;
  role: string;
  dept: string;
  branchPrefix: string;
  defaultSkillIds: string[];
  color?: string;
}

// --- File helpers ---
const chaperoneDir = (workspacePath: string) => path.join(workspacePath, '.chaperone');

const filePath = (workspacePath: string, name: string) =>
  path.join(chaperoneDir(workspacePath), name);

function readJson<T>(workspacePath: string, name: string, fallback: T): T {
  try {
    const p = filePath(workspacePath, name);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf-8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(workspacePath: string, name: string, data: unknown): void {
  const dir = chaperoneDir(workspacePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath(workspacePath, name), JSON.stringify(data, null, 2));
}

// --- Team (team.json) ---
const TEAM_FILE = 'team.json';

export function getWorkers(workspacePath: string): Worker[] {
  return readJson<Worker[]>(workspacePath, TEAM_FILE, []);
}

/** Assign the next "W#" id (max existing + 1). */
function nextWorkerId(workers: Worker[]): string {
  let max = 0;
  for (const w of workers) {
    const m = /^W(\d+)$/.exec(w.id || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `W${max + 1}`;
}

export function addWorker(workspacePath: string, worker: Partial<Worker>): Worker {
  const workers = getWorkers(workspacePath);
  const created: Worker = {
    id: nextWorkerId(workers),
    displayName: worker.displayName || '',
    role: worker.role || '',
    dept: worker.dept || '',
    branchPrefix: worker.branchPrefix || '',
    loadout: worker.loadout || [],
    createdAt: worker.createdAt || new Date().toISOString(),
  };
  workers.push(created);
  writeJson(workspacePath, TEAM_FILE, workers);
  return created;
}

export function updateWorker(
  workspacePath: string,
  id: string,
  patch: Partial<Worker>,
): Worker | null {
  const workers = getWorkers(workspacePath);
  const idx = workers.findIndex(w => w.id === id);
  if (idx === -1) return null;
  // id is immutable
  const { id: _ignore, ...safePatch } = patch as any;
  workers[idx] = { ...workers[idx], ...safePatch };
  writeJson(workspacePath, TEAM_FILE, workers);
  return workers[idx];
}

export function deleteWorker(workspacePath: string, id: string): boolean {
  const workers = getWorkers(workspacePath);
  const next = workers.filter(w => w.id !== id);
  if (next.length === workers.length) return false;
  writeJson(workspacePath, TEAM_FILE, next);
  return true;
}

// --- Saved sets (saved-sets.json) ---
const SETS_FILE = 'saved-sets.json';

export function getSavedSets(workspacePath: string): SavedSet[] {
  return readJson<SavedSet[]>(workspacePath, SETS_FILE, []);
}

function nextSetId(sets: SavedSet[]): string {
  return `set-${Date.now()}-${sets.length}`;
}

export function addSavedSet(workspacePath: string, set: Partial<SavedSet>): SavedSet {
  const sets = getSavedSets(workspacePath);
  const created: SavedSet = {
    id: set.id || nextSetId(sets),
    label: set.label || '',
    skillIds: set.skillIds || [],
    owner: set.owner === 'pm' ? 'pm' : 'you',
  };
  sets.push(created);
  writeJson(workspacePath, SETS_FILE, sets);
  return created;
}

export function updateSavedSet(
  workspacePath: string,
  id: string,
  patch: Partial<SavedSet>,
): SavedSet | null {
  const sets = getSavedSets(workspacePath);
  const idx = sets.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const { id: _ignore, ...safePatch } = patch as any;
  sets[idx] = { ...sets[idx], ...safePatch };
  writeJson(workspacePath, SETS_FILE, sets);
  return sets[idx];
}

export function deleteSavedSet(workspacePath: string, id: string): boolean {
  const sets = getSavedSets(workspacePath);
  const next = sets.filter(s => s.id !== id);
  if (next.length === sets.length) return false;
  writeJson(workspacePath, SETS_FILE, next);
  return true;
}

// --- Role presets (role-presets.json) ---
const PRESETS_FILE = 'role-presets.json';

// Seed data — mirrors ROLE_PRESETS in
// .design/agent-company/project/wf-skills-data.jsx (the 6 built-ins).
const SEED_PRESETS: RolePreset[] = [
  { id: 'fe', role: 'Frontend', dept: 'Engineering', branchPrefix: 'feat/ui-',   defaultSkillIds: ['css-th', 'a11y', 'tdd'], color: 'var(--w1)' },
  { id: 'be', role: 'Backend',  dept: 'Engineering', branchPrefix: 'feat/api-',  defaultSkillIds: ['rest', 'sec', 'tdd'],    color: 'var(--w2)' },
  { id: 'mo', role: 'Mobile',   dept: 'Engineering', branchPrefix: 'feat/mob-',  defaultSkillIds: ['rn', 'tdd'],             color: 'var(--w3)' },
  { id: 'qa', role: 'QA',       dept: 'Engineering', branchPrefix: 'feat/test-', defaultSkillIds: ['tdd', 'playwr'],         color: 'var(--w4)' },
  { id: 'do', role: 'DevOps',   dept: 'Engineering', branchPrefix: 'chore/ops-', defaultSkillIds: ['cloud', 'sec'],          color: '#5a5c66' },
  { id: 'da', role: 'Data',     dept: 'Engineering', branchPrefix: 'feat/data-', defaultSkillIds: ['tdd'],                   color: '#a86970' },
];

/** On first GET, seed the 6 built-ins to disk. User may add more afterwards. */
export function getRolePresets(workspacePath: string): RolePreset[] {
  const p = filePath(workspacePath, PRESETS_FILE);
  if (!fs.existsSync(p)) {
    writeJson(workspacePath, PRESETS_FILE, SEED_PRESETS);
    return SEED_PRESETS;
  }
  return readJson<RolePreset[]>(workspacePath, PRESETS_FILE, SEED_PRESETS);
}

// --- PM Parallelization Plan (pm-plan.json) ---
// S1 of the PM-model slice: the PM reads the real project and produces a plan
// (golden path, foundation files, gear, read-only audit allocation). Persisted so
// it survives reload — see docs/ACCEPTANCE.md.
const PM_PLAN_FILE = 'pm-plan.json';

export interface PmPlanRecord {
  goal: string;
  createdAt: string;
  model?: string;
  plan: unknown; // structured plan object (see /api/pm/plan)
}

export function getPmPlan(workspacePath: string): PmPlanRecord | null {
  return readJson<PmPlanRecord | null>(workspacePath, PM_PLAN_FILE, null);
}

export function savePmPlan(workspacePath: string, record: PmPlanRecord): PmPlanRecord {
  writeJson(workspacePath, PM_PLAN_FILE, record);
  return record;
}

// --- Progress Map (progress.json) ---
// Structured source of truth for the global Progress board (D2). The PM writes this
// on every state change; the board only renders it. PROGRESS.md stays the human
// narrative/log. Internal status uses the 7-state lifecycle (PM_OPERATING_MODEL §2);
// the UI folds them into 5 CEO-facing labels.
const PROGRESS_FILE = 'progress.json';

export type SliceStatus =
  | 'pending' | 'in_progress' | 'ai_verified'
  | 'awaiting_human_acceptance' | 'accepted' | 'blocked' | 'regressed';

export interface ProgressSubtask { id: string; name: string; status: SliceStatus; }
export interface ProgressSlice {
  id: string; name: string;
  kind: 'golden' | 'support';
  status: SliceStatus;
  subtasks?: ProgressSubtask[];
}
export interface ProgressDoc {
  mvpGoal: string;
  gear: 'L1' | 'L2' | 'L3';
  volatility: 'High' | 'Medium' | 'Low';
  slices: ProgressSlice[];
  updatedAt: string;
}

// An EMPTY map for a project with no progress tracking yet. We must NOT fabricate slices:
// a fresh project honestly has none until the PM builds them by reading the project.
// (Chaperone's own dogfooding slices live in agent-company's real .chaperone/progress.json, not
// in a code seed that would pollute every other project — that was the bug.)
const EMPTY_PROGRESS: ProgressDoc = {
  mvpGoal: '',
  gear: 'L1',
  volatility: 'High',
  slices: [],
  updatedAt: new Date().toISOString(),
};

/** Return the real progress map if it exists; otherwise an EMPTY map (no fabrication). */
export function getProgress(workspacePath: string): ProgressDoc {
  const p = filePath(workspacePath, PROGRESS_FILE);
  if (!fs.existsSync(p)) return EMPTY_PROGRESS;
  return readJson<ProgressDoc>(workspacePath, PROGRESS_FILE, EMPTY_PROGRESS);
}

export function saveProgress(workspacePath: string, doc: Partial<ProgressDoc>): ProgressDoc {
  const current = getProgress(workspacePath);
  const next = { ...current, ...doc, updatedAt: new Date().toISOString() };
  writeJson(workspacePath, PROGRESS_FILE, next);
  return next;
}
