// Running record of what the models have actually consumed.
//
// The point is not accounting, it is nerve: someone bringing their own API key
// has no idea whether a run costs a fraction of a cent or several dollars, and
// that uncertainty is a good reason not to press the button. Every model call
// reports its tokens here, so the number in the UI is measured, not guessed.

import fs from 'fs';
import path from 'path';
import { TokenUsage } from './providers/types';
import { estimateCost } from './pricing';

export interface UsageEntry {
  at: string;          // ISO timestamp
  model: string;
  /** What the tokens were spent on — 'pm-chat', 'explore', 'mission:<id>', … */
  scope: string;
  input: number;
  output: number;
  cached: number;
  /** null when no rate is known for that model. */
  usd: number | null;
}

export interface UsageTotals {
  input: number;
  output: number;
  cached: number;
  calls: number;
  usd: number;          // sum of the entries we could price
  unpricedCalls: number; // calls whose model had no known rate
}

const emptyTotals = (): UsageTotals => ({ input: 0, output: 0, cached: 0, calls: 0, usd: 0, unpricedCalls: 0 });

let entries: UsageEntry[] = [];
let filePath = '';
const MAX_ENTRIES = 5000;

/** Restore history so the total survives a restart. */
export function loadUsage(dataDir: string) {
  filePath = path.join(dataDir, 'usage.json');
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(raw?.entries)) entries = raw.entries;
  } catch { entries = []; }
}

let saveTimer: NodeJS.Timeout | null = null;
function saveSoon() {
  if (!filePath || saveTimer) return;
  // Batched: a single mission can produce dozens of calls a minute.
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.writeFileSync(filePath, JSON.stringify({ entries }, null, 2)); } catch { /* non-fatal */ }
  }, 2000);
}

export function recordUsage(model: string, scope: string, usage?: TokenUsage) {
  if (!usage) return;   // provider reported nothing; record nothing rather than a zero
  const { usd } = estimateCost(model, usage);
  entries.push({
    at: new Date().toISOString(),
    model,
    scope,
    input: usage.input || 0,
    output: usage.output || 0,
    cached: usage.cached || 0,
    usd,
  });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  saveSoon();
}

function sum(list: UsageEntry[]): UsageTotals {
  return list.reduce((t, e) => ({
    input: t.input + e.input,
    output: t.output + e.output,
    cached: t.cached + e.cached,
    calls: t.calls + 1,
    usd: t.usd + (e.usd ?? 0),
    unpricedCalls: t.unpricedCalls + (e.usd === null ? 1 : 0),
  }), emptyTotals());
}

export const totals = () => sum(entries);
export const totalsForScope = (scope: string) => sum(entries.filter(e => e.scope === scope));
export const totalsSince = (iso: string) => sum(entries.filter(e => e.at >= iso));
export const recentEntries = (n = 50) => entries.slice(-n).reverse();

/** Per-model breakdown, biggest spender first. */
export function byModel(): { model: string; totals: UsageTotals }[] {
  const groups = new Map<string, UsageEntry[]>();
  for (const e of entries) {
    if (!groups.has(e.model)) groups.set(e.model, []);
    groups.get(e.model)!.push(e);
  }
  return [...groups.entries()]
    .map(([model, list]) => ({ model, totals: sum(list) }))
    .sort((a, b) => b.totals.usd - a.totals.usd);
}
