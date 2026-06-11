// Provider factory. Engine selection happens here based on available keys.
// Default is Gemini; Claude is used when ANTHROPIC_API_KEY is set. Constructed
// fresh each call so a runtime key change (POST /api/config) is picked up.

import { ModelProvider } from './types';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';

const getGeminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const getAnthropicKey = () => process.env.ANTHROPIC_API_KEY || '';
const getClaudeModel = () => process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-opus-4-8';

export function getProvider(): ModelProvider {
  // Claude wins when its key is present; otherwise default to Gemini.
  const anthropicKey = getAnthropicKey();
  if (anthropicKey) {
    return new ClaudeProvider(anthropicKey, getClaudeModel());
  }
  return new GeminiProvider(getGeminiKey(), getGeminiModel());
}

export * from './types';
