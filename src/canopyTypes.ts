// Canopy shared types — team / skills / loadouts / saved sets.
//
// Everything here is USER-DEFINED and starts EMPTY. The user creates their own
// workers, skills, and saved sets. The PM may *suggest* presets per task, but the
// user decides whether to adopt them — nothing is pre-populated for them.
//
// Persisted as JSON files under <projectPath>/.canopy/ via the backend
// (see docs/API_CONTRACT.md). Frontend and backend both build to these shapes.

export interface Skill {
  id: string;                 // slug, e.g. "tdd-expert"
  name: string;
  description: string;
  category: string;           // "Frontend" | "Backend" | "Testing" | … | "Universal"
  source: 'built-in' | 'you' | 'github';
  color?: string;
}

export interface SavedSet {
  id: string;
  label: string;
  skillIds: string[];         // ids into the skill library
  owner: 'you' | 'pm';
}

export interface RolePreset {
  id: string;
  role: string;               // "Frontend" | "Backend" | …
  dept: string;
  branchPrefix: string;       // "feat/ui-"
  defaultSkillIds: string[];
  color?: string;
}

// A recruited, persistent team member (distinct from a per-mission Assignment).
export interface Worker {
  id: string;                 // "W1", "W2", …
  displayName: string;
  role: string;
  dept: string;
  branchPrefix: string;
  loadout: string[];          // equipped skill ids — soft cap ~8–10 custom + base set
  createdAt: string;
}

// PM's pre-plan clarifying question (the "clarify" step before a plan).
export interface ClarifyQuestion {
  key: string;
  label: string;              // e.g. "Scope of share"
  options: string[];          // 2–4 chip choices
}
