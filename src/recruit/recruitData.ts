// Recruit feature — shared data, types, and fetch helpers.
//
// Everything is USER-DEFINED. Role presets are editable SUGGESTIONS seeded by the
// backend (GET /api/role-presets). Skills come from GET /api/skills. The worker is
// created via POST /api/team (server assigns the next W#).
//
// All API/type shapes follow docs/API_CONTRACT.md + src/chaperoneTypes.ts.

import type { RolePreset, SavedSet, Skill, Worker } from '../chaperoneTypes';

export const API_BASE = 'http://localhost:3005';

// ── Local fallbacks (used only when a fetch fails / returns empty) ───────────
// Mirrors ROLE_PRESETS in .design/agent-company/project/wf-skills-data.jsx so the
// modal degrades gracefully offline. The backend is the source of truth.
export const FALLBACK_PRESETS: RolePreset[] = [
  { id: 'fe', role: 'Frontend', dept: 'Engineering', branchPrefix: 'feat/ui-',   defaultSkillIds: ['css-th', 'a11y', 'tdd'], color: 'var(--w1)' },
  { id: 'be', role: 'Backend',  dept: 'Engineering', branchPrefix: 'feat/api-',  defaultSkillIds: ['rest', 'sec', 'tdd'],    color: 'var(--w2)' },
  { id: 'mo', role: 'Mobile',   dept: 'Engineering', branchPrefix: 'feat/mob-',  defaultSkillIds: ['rn', 'tdd'],             color: 'var(--w3)' },
  { id: 'qa', role: 'QA',       dept: 'Engineering', branchPrefix: 'feat/test-', defaultSkillIds: ['tdd', 'playwr'],         color: 'var(--w4)' },
  { id: 'do', role: 'DevOps',   dept: 'Engineering', branchPrefix: 'chore/ops-', defaultSkillIds: ['cloud', 'sec'],          color: '#5a5c66' },
  { id: 'da', role: 'Data',     dept: 'Engineering', branchPrefix: 'feat/data-', defaultSkillIds: ['tdd'],                   color: '#a86970' },
];

// Descriptions are presentational only; not in the RolePreset type. Keyed by id.
export const PRESET_DESC: Record<string, string> = {
  fe: 'UI components, hooks, state management, styling.',
  be: 'APIs, data models, business logic, persistence.',
  mo: 'iOS / Android / RN. Native bridges and platform glue.',
  qa: 'Tests, CI, regression suites, coverage gates.',
  do: 'Deploy, infra, monitoring, secrets, CI/CD.',
  da: 'Analytics, instrumentation, ML, data pipelines.',
};

export const FALLBACK_SKILLS: Skill[] = [
  { id: 'tdd',      name: 'TDD-Expert',           category: 'Testing',  source: 'built-in', description: 'Write tests before code; refuse to merge red builds.',  color: '#4a7c4a' },
  { id: 'a11y',     name: 'a11y-audit',           category: 'Frontend', source: 'built-in', description: 'Run axe-core on touched components; flag violations.',   color: '#3b6aa8' },
  { id: 'cloud',    name: 'Cloud-Deploy',         category: 'DevOps',   source: 'built-in', description: 'Vercel + GitHub Actions deploy on green main.',          color: '#8a6a3a' },
  { id: 'css-th',   name: 'css-theming',          category: 'Frontend', source: 'you',      description: 'CSS variables only. No styled-components.',              color: '#3b6aa8' },
  { id: 'rest',     name: 'REST-API-design',      category: 'Backend',  source: 'github',   description: 'OpenAPI 3 first; verbs, status codes, pagination.',      color: '#6b4e7f' },
  { id: 'perf',     name: 'perf-budget',          category: 'Frontend', source: 'you',      description: 'TTI < 2s · bundle < 200kb · lighthouse 95+.',            color: '#3b6aa8' },
  { id: 'sec',      name: 'OWASP-checklist',      category: 'Backend',  source: 'github',   description: 'Top 10 review · sanitization · rate limit · cors.',      color: '#6b4e7f' },
  { id: 'conv-cmt', name: 'Conventional-Commits', category: 'Workflow', source: 'built-in', description: 'feat: / fix: / chore: + scope. Imperative mood.',        color: '#5a5750' },
  { id: 'rn',       name: 'react-native-bridge',  category: 'Mobile',   source: 'you',      description: 'Wrap web components for RN. Share state via context.',   color: '#c98a5a' },
  { id: 'playwr',   name: 'playwright-e2e',       category: 'Testing',  source: 'github',   description: 'Run e2e on every PR · screenshot diff on failure.',      color: '#4a7c4a' },
];

export const FALLBACK_SAVED_SETS: SavedSet[] = [
  { id: 'be-strict', label: 'Backend · strict',   skillIds: ['rest', 'sec', 'tdd', 'conv-cmt'], owner: 'you' },
  { id: 'qa-full',   label: 'QA · full coverage', skillIds: ['tdd', 'playwr', 'conv-cmt'],      owner: 'pm' },
];

// ── Normalizers ─────────────────────────────────────────────────────────────
// The skills endpoint historically returns { name, description, category?, source? }
// without an id (see API_CONTRACT). Slugify name -> id so loadouts stay stable.
export function slugify(s: string): string {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeSkill(raw: any): Skill {
  const name = raw?.name ?? 'skill';
  return {
    id: raw?.id != null ? String(raw.id) : slugify(name),
    name,
    description: raw?.description ?? raw?.desc ?? '',
    category: raw?.category ?? raw?.cat ?? 'Universal',
    source: (raw?.source ?? 'built-in') as Skill['source'],
    color: raw?.color,
  };
}

export function normalizePreset(raw: any): RolePreset {
  return {
    id: raw?.id != null ? String(raw.id) : slugify(raw?.role ?? 'role'),
    role: raw?.role ?? 'Role',
    dept: raw?.dept ?? 'Engineering',
    branchPrefix: raw?.branchPrefix ?? 'feat/',
    defaultSkillIds: raw?.defaultSkillIds ?? raw?.defaultSkills ?? [],
    color: raw?.color,
  };
}

// ── Fetch helpers (graceful — never throw to the UI) ─────────────────────────
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRolePresets(workspacePath: string): Promise<RolePreset[]> {
  const data = await getJson(`${API_BASE}/api/role-presets?workspacePath=${encodeURIComponent(workspacePath)}`);
  const list: any[] = data?.presets ?? [];
  if (!Array.isArray(list) || list.length === 0) return FALLBACK_PRESETS;
  return list.map(normalizePreset);
}

export async function fetchSkills(workspacePath: string): Promise<Skill[]> {
  // Note: legacy /api/skills ignores workspacePath but accepting it is harmless.
  const data = await getJson(`${API_BASE}/api/skills?workspacePath=${encodeURIComponent(workspacePath)}`);
  const list: any[] = data?.skills ?? [];
  if (!Array.isArray(list) || list.length === 0) return FALLBACK_SKILLS;
  return list.map(normalizeSkill);
}

export async function fetchSavedSets(workspacePath: string): Promise<SavedSet[]> {
  const data = await getJson(`${API_BASE}/api/saved-sets?workspacePath=${encodeURIComponent(workspacePath)}`);
  const list: any[] = data?.sets ?? [];
  if (!Array.isArray(list)) return FALLBACK_SAVED_SETS;
  return list.map((s) => ({
    id: String(s.id),
    label: s.label ?? 'set',
    skillIds: s.skillIds ?? s.skills ?? [],
    owner: (s.owner ?? 'you') as SavedSet['owner'],
  }));
}

// POST the new worker (no id). Server assigns the next W#.
// Returns the persisted Worker on success, or null on failure.
export async function postWorker(workspacePath: string, worker: Omit<Worker, 'id' | 'createdAt'>): Promise<Worker | null> {
  try {
    const res = await fetch(`${API_BASE}/api/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, worker }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.worker ?? null;
  } catch {
    return null;
  }
}

// Best-effort next-id label for the Identity preview (server assigns the real one).
export function nextWorkerLabel(existing: Worker[] | undefined): string {
  const nums = (existing ?? [])
    .map((w) => parseInt(String(w.id).replace(/^W/i, ''), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `W${next}`;
}
