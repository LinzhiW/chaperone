// Cost estimation.
//
// Token counts come from the provider and are exact. Prices do not: they change,
// they differ between a provider's own API and a reseller, and published figures
// disagree with each other. So this file ships defaults with the date they were
// checked, and every number can be overridden by the user in rates.json without
// touching code. Anything we have no rate for still reports its real token count
// and simply says the cost is unknown — better than a confident wrong number.

import fs from 'fs';
import path from 'path';
import { TokenUsage } from './providers/types';

/** USD per 1,000,000 tokens. */
export interface Rate {
  input: number;
  output: number;
  /** Per-MTok price for cache-read input, where the provider offers one. */
  cached?: number;
}

export const RATES_CHECKED = '2026-09-06';

export const PRICING_SOURCES: Record<string, string> = {
  claude: 'https://www.anthropic.com/pricing',
  openai: 'https://openai.com/api/pricing/',
  gemini: 'https://ai.google.dev/pricing',
};

// Longest matching prefix wins, so `claude-opus-5` beats a bare `claude-`.
const DEFAULT_RATES: Record<string, Rate> = {
  // Anthropic
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },

  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },
  'gpt-4o': { input: 2.5, output: 10, cached: 1.25 },

  // Google — its own API pricing; resellers charge differently, which is one
  // reason these are overridable.
  'gemini-2.5-flash-lite': { input: 0.05, output: 0.2 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cached: 0.03 },
  // Alias that always points at the current flash model, which is what the app
  // defaults to so a retired version can't strand anyone. Its rate moves with
  // whatever it resolves to — check the pricing page if the number looks wrong.
  'gemini-flash-latest': { input: 0.3, output: 2.5, cached: 0.03 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

let overrides: Record<string, Rate> = {};
let overridesPath = '';

/**
 * Load user rate overrides from <dataDir>/rates.json. Shape is the same as
 * DEFAULT_RATES: { "model-prefix": { "input": 1.5, "output": 6 } }.
 */
export function loadRates(dataDir: string) {
  overridesPath = path.join(dataDir, 'rates.json');
  try {
    const raw = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
    if (raw && typeof raw === 'object') overrides = raw.rates && typeof raw.rates === 'object' ? raw.rates : raw;
  } catch { overrides = {}; }
}

export const ratesFilePath = () => overridesPath;

/** All rates in effect, user overrides winning over defaults. */
export const effectiveRates = (): Record<string, Rate> => ({ ...DEFAULT_RATES, ...overrides });

export function rateFor(model: string): Rate | null {
  const all = effectiveRates();
  const id = (model || '').toLowerCase();
  let best: { key: string; rate: Rate } | null = null;
  for (const [key, rate] of Object.entries(all)) {
    if (id.startsWith(key.toLowerCase()) && (!best || key.length > best.key.length)) best = { key, rate };
  }
  return best ? best.rate : null;
}

export interface CostEstimate {
  usd: number | null;   // null when no rate is known for the model
  known: boolean;
}

export function estimateCost(model: string, usage: TokenUsage): CostEstimate {
  const rate = rateFor(model);
  if (!rate) return { usd: null, known: false };

  const cached = usage.cached || 0;
  const freshInput = Math.max(0, usage.input - cached);
  const cachedRate = rate.cached ?? rate.input;

  const usd =
    (freshInput / 1_000_000) * rate.input +
    (cached / 1_000_000) * cachedRate +
    (usage.output / 1_000_000) * rate.output;

  return { usd, known: true };
}

/** "$0.0043" / "<$0.0001" / "—" — small numbers are the norm here. */
export function formatUsd(usd: number | null): string {
  if (usd === null) return '—';
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
