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

export function getProvider(): ModelProvider {
  const anthropicKey = getAnthropicKey();
  if (anthropicKey) return new ClaudeProvider(anthropicKey, getClaudeModel());

  const openaiKey = getOpenAIKey();
  if (openaiKey) return new OpenAIProvider(openaiKey, getOpenAIModel());

  return new GeminiProvider(getGeminiKey(), getGeminiModel());
}

export * from './types';
