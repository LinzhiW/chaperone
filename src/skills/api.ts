// Skills UI — API client + shared helpers.
//
// All data is USER-DEFINED and starts EMPTY. Every fetch degrades gracefully
// when the backend (http://localhost:3005) is offline or returns nothing —
// callers get empty arrays, never throw.
//
// Endpoints (see docs/API_CONTRACT.md):
//   GET  /api/skills                                  → { skills: {...}[] }
//   POST /api/add-skill        { name, content, ... } → created skill
//   GET  /api/team?workspacePath=…                    → { workers: Worker[] }
//   PUT  /api/team/:id         { workspacePath, patch }→ { worker }
//   GET  /api/saved-sets?workspacePath=…              → { sets: SavedSet[] }
//   POST /api/saved-sets       { workspacePath, set } → { set }
//   GET  /api/role-presets?workspacePath=…            → { presets: RolePreset[] }

import type { Skill, SavedSet, Worker, RolePreset } from '../chaperoneTypes';

export { API_BASE } from '../config';
import { API_BASE } from '../config';

// ─── Color assignment ──────────────────────────────────────────────────────
// Skills come from the backend without colors; assign a stable warm-paper hue
// per category so cards/chips stay visually consistent across screens.
const CATEGORY_COLORS: Record<string, string> = {
  Frontend: '#3b6aa8',
  Backend: '#6b4e7f',
  Mobile: '#c98a5a',
  Testing: '#4a7c4a',
  QA: '#4a7c4a',
  DevOps: '#8a6a3a',
  Data: '#a86970',
  Workflow: '#5a5750',
  Universal: '#5a5750',
};
const FALLBACK_COLORS = ['#3b6aa8', '#6b4e7f', '#4a7c4a', '#c98a5a', '#8a6a3a', '#a86970', '#5a5750'];

export function colorForSkill(s: { category?: string; id?: string; color?: string }): string {
  if (s.color) return s.color;
  if (s.category && CATEGORY_COLORS[s.category]) return CATEGORY_COLORS[s.category];
  // deterministic fallback from id so the same skill is always the same color
  const key = s.id ?? s.category ?? '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

// Normalize whatever /api/skills returns into our Skill shape.
function normalizeSkill(raw: any, i: number): Skill {
  const name: string = raw?.name ?? `skill-${i}`;
  const id: string = raw?.id ?? slugify(name);
  const category: string = raw?.category ?? 'Universal';
  const sourceRaw = (raw?.source ?? '').toString().toLowerCase();
  const source: Skill['source'] =
    sourceRaw === 'github' ? 'github' :
    sourceRaw === 'you' || sourceRaw === 'local' ? 'you' :
    'built-in';
  const skill: Skill = {
    id,
    name,
    description: raw?.description ?? '',
    category,
    source,
  };
  skill.color = colorForSkill(skill);
  return skill;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function getJSON(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Skills ─────────────────────────────────────────────────────────────────
export async function fetchSkills(): Promise<Skill[]> {
  const data = await getJSON(`${API_BASE}/api/skills`);
  if (!data?.skills || !Array.isArray(data.skills)) return [];
  return data.skills.map(normalizeSkill);
}

export interface AddSkillInput {
  name: string;
  content: string;
  category?: string;
  description?: string;
  source?: Skill['source'];
  githubUrl?: string;
  equipOn?: string | null; // worker id, or null/'' for library-only
}

export async function addSkill(input: AddSkillInput): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/add-skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// ─── Team ─────────────────────────────────────────────────────────────────
export async function fetchTeam(workspacePath: string): Promise<Worker[]> {
  if (!workspacePath) return [];
  const data = await getJSON(`${API_BASE}/api/team?workspacePath=${encodeURIComponent(workspacePath)}`);
  if (!data?.workers || !Array.isArray(data.workers)) return [];
  return data.workers;
}

export async function updateWorker(
  workspacePath: string,
  id: string,
  patch: Partial<Worker>,
): Promise<{ ok: boolean; worker?: Worker }> {
  try {
    const res = await fetch(`${API_BASE}/api/team/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, patch }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: true, worker: data?.worker };
  } catch {
    return { ok: false };
  }
}

// ─── Saved sets ─────────────────────────────────────────────────────────────
export async function fetchSavedSets(workspacePath: string): Promise<SavedSet[]> {
  if (!workspacePath) return [];
  const data = await getJSON(`${API_BASE}/api/saved-sets?workspacePath=${encodeURIComponent(workspacePath)}`);
  if (!data?.sets || !Array.isArray(data.sets)) return [];
  return data.sets;
}

export async function createSavedSet(
  workspacePath: string,
  set: Omit<SavedSet, 'id'>,
): Promise<{ ok: boolean; set?: SavedSet }> {
  try {
    const res = await fetch(`${API_BASE}/api/saved-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath, set }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: true, set: data?.set };
  } catch {
    return { ok: false };
  }
}

// ─── Role presets ─────────────────────────────────────────────────────────────
export async function fetchRolePresets(workspacePath: string): Promise<RolePreset[]> {
  if (!workspacePath) return [];
  const data = await getJSON(`${API_BASE}/api/role-presets?workspacePath=${encodeURIComponent(workspacePath)}`);
  if (!data?.presets || !Array.isArray(data.presets)) return [];
  return data.presets;
}

// ─── Source display helpers ─────────────────────────────────────────────────
export function sourceLabel(source: Skill['source']): string {
  return source === 'github' ? 'GitHub' : source === 'you' ? 'you' : 'built-in';
}
export function sourceIcon(source: Skill['source']): string {
  return source === 'github' ? '⌥' : source === 'you' ? '✎' : '■';
}
