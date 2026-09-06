// Provider factory. Engine selection happens here based on available keys.
// Priority: Claude (ANTHROPIC_API_KEY) > OpenAI (OPENAI_API_KEY) > Gemini (default).
// Constructed fresh each call so a runtime key change (POST /api/config) is picked up.

import { ModelProvider, TokenUsage } from './types';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';

const getGeminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const getAnthropicKey = () => process.env.ANTHROPIC_API_KEY || '';
const getClaudeModel = () => process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-opus-5';

const getOpenAIKey = () => process.env.OPENAI_API_KEY || '';
const getOpenAIModel = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

// One user-defined slot for any OpenAI-compatible endpoint — DeepSeek, Kimi, GLM,
// Qwen, MiniMax, OpenRouter, or a local Ollama/vLLM server. They all speak the
// same dialect, so the OpenAI adapter serves them with only a different baseURL;
// no new adapter, no partnership, just an API key. Needs both a key and a URL.
const getCustomKey = () => process.env.CUSTOM_API_KEY || '';
const getCustomBaseUrl = () => process.env.CUSTOM_BASE_URL || '';
const getCustomModel = () => process.env.CUSTOM_MODEL || '';
const getCustomLabel = () => process.env.CUSTOM_LABEL || getCustomModel() || 'custom';
const customReady = () => !!(getCustomKey() && getCustomBaseUrl() && getCustomModel());
const makeCustom = () => new OpenAIProvider(getCustomKey(), getCustomModel(), {
  baseURL: getCustomBaseUrl(), id: 'custom', label: getCustomLabel(),
});

// S7: runtime provider override. Default = auto (key priority). CEO can pin one via
// POST /api/provider — honored here as long as that provider's key exists.
export type ProviderId = 'auto' | 'custom' | 'claude' | 'openai' | 'gemini';
let providerOverride: ProviderId = 'auto';
export function setProviderOverride(id: ProviderId) { providerOverride = id; }
export function getProviderOverride(): ProviderId { return providerOverride; }

/** Which providers have a usable key right now (for the selection UI). */
export function availableProviders(): { id: Exclude<ProviderId, 'auto'>; label: string; ready: boolean }[] {
  return [
    { id: 'custom', label: getCustomLabel(), ready: customReady() },
    { id: 'claude', label: getClaudeModel(), ready: !!getAnthropicKey() },
    { id: 'openai', label: getOpenAIModel(), ready: !!getOpenAIKey() },
    { id: 'gemini', label: getGeminiModel(), ready: !!getGeminiKey() },
  ];
}

/**
 * Wrap a provider so every call it makes is metered. Doing it here rather than at
 * each call site means a new endpoint cannot forget to report what it spent — the
 * only way to reach a model is through this factory.
 */
function metered(p: ModelProvider, scope: string): ModelProvider {
  const record = (usage?: TokenUsage) => {
    if (usage) onUsage?.(p.modelLabel, scope, usage);
  };
  return {
    id: p.id,
    modelLabel: p.modelLabel,
    startChat(opts) {
      const session = p.startChat(opts);
      return {
        async sendMessage(text) { const t = await session.sendMessage(text); record(t.usage); return t; },
        async sendToolResults(results) { const t = await session.sendToolResults(results); record(t.usage); return t; },
      };
    },
    async generateOnce(prompt) { const r = await p.generateOnce(prompt); record(r.usage); return r; },
  };
}

// Set once at startup by the server; kept as a hook so this module stays free of
// filesystem and bookkeeping concerns.
let onUsage: ((model: string, scope: string, usage: TokenUsage) => void) | null = null;
export function setUsageRecorder(fn: (model: string, scope: string, usage: TokenUsage) => void) { onUsage = fn; }

/** @param scope what the spend is for — 'pm-chat', 'explore', `mission:<id>`… */
export function getProvider(scope = 'other'): ModelProvider {
  return metered(pickProvider(), scope);
}

function pickProvider(): ModelProvider {
  const anthropicKey = getAnthropicKey();
  const openaiKey = getOpenAIKey();

  // Honor an explicit override when that provider is fully configured.
  if (providerOverride === 'custom' && customReady()) return makeCustom();
  if (providerOverride === 'claude' && anthropicKey) return new ClaudeProvider(anthropicKey, getClaudeModel());
  if (providerOverride === 'openai' && openaiKey) return new OpenAIProvider(openaiKey, getOpenAIModel());
  if (providerOverride === 'gemini' && getGeminiKey()) return new GeminiProvider(getGeminiKey(), getGeminiModel());

  // Auto: Custom > Claude > OpenAI > Gemini. Custom leads because filling in a
  // base URL is a deliberate act — nobody has one lying around by accident.
  if (customReady()) return makeCustom();
  if (anthropicKey) return new ClaudeProvider(anthropicKey, getClaudeModel());
  if (openaiKey) return new OpenAIProvider(openaiKey, getOpenAIModel());
  return new GeminiProvider(getGeminiKey(), getGeminiModel());
}

export * from './types';
