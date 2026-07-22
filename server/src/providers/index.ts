// Provider factory. Engine selection happens here based on available keys.
// Priority: Claude (ANTHROPIC_API_KEY) > OpenAI (OPENAI_API_KEY) > Gemini (default).
// Constructed fresh each call so a runtime key change (POST /api/config) is picked up.

import { ModelProvider } from './types';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';

const getGeminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const getAnthropicKey = () => process.env.ANTHROPIC_API_KEY || '';
const getClaudeModel = () => process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-opus-4-8';

const getOpenAIKey = () => process.env.OPENAI_API_KEY || '';
const getOpenAIModel = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

// S7: runtime provider override. Default = auto (key priority). CEO can pin one via
// POST /api/provider — honored here as long as that provider's key exists.
export type ProviderId = 'auto' | 'claude' | 'openai' | 'gemini';
let providerOverride: ProviderId = 'auto';
export function setProviderOverride(id: ProviderId) { providerOverride = id; }
export function getProviderOverride(): ProviderId { return providerOverride; }

/** Which providers have a usable key right now (for the selection UI). */
export function availableProviders(): { id: Exclude<ProviderId, 'auto'>; label: string; ready: boolean }[] {
  return [
    { id: 'claude', label: getClaudeModel(), ready: !!getAnthropicKey() },
    { id: 'openai', label: getOpenAIModel(), ready: !!getOpenAIKey() },
    { id: 'gemini', label: getGeminiModel(), ready: !!getGeminiKey() },
  ];
}

export function getProvider(): ModelProvider {
  const anthropicKey = getAnthropicKey();
  const openaiKey = getOpenAIKey();

  // Honor an explicit override when that provider's key is present.
  if (providerOverride === 'claude' && anthropicKey) return new ClaudeProvider(anthropicKey, getClaudeModel());
  if (providerOverride === 'openai' && openaiKey) return new OpenAIProvider(openaiKey, getOpenAIModel());
  if (providerOverride === 'gemini' && getGeminiKey()) return new GeminiProvider(getGeminiKey(), getGeminiModel());

  // Auto: key priority (Claude > OpenAI > Gemini).
  if (anthropicKey) return new ClaudeProvider(anthropicKey, getClaudeModel());
  if (openaiKey) return new OpenAIProvider(openaiKey, getOpenAIModel());
  return new GeminiProvider(getGeminiKey(), getGeminiModel());
}

export * from './types';
