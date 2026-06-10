// Provider factory. For now there is exactly one provider (Gemini); engine
// selection (TODO P3) will switch here on config / available keys. Constructed
// fresh each call so a runtime key change (POST /api/config) is picked up.

import { ModelProvider } from './types';
import { GeminiProvider } from './gemini';

const getApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const getModelId = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export function getProvider(): ModelProvider {
  // switch (chosenEngine) { case 'claude': ... }  ← TODO P2/P3
  return new GeminiProvider(getApiKey(), getModelId());
}

export * from './types';
