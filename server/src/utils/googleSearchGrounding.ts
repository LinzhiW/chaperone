import axios from 'axios';

const RECENT_INFO_PATTERN =
  /(最新|最近|近期|当前|现在|截至|今年|本月|本周|today|current|latest|recent|newest|as of|up[- ]to[- ]date|this week|this month|this year|2025|2026)/i;

const FAST_MOVING_TECH_BRAND_PATTERN =
  /\b(claude(?:\s+code)?|cursor|anthropic|openai|gemini|mcp|langchain|autogen|crewai|vercel ai sdk)\b/i;

const FAST_MOVING_TECH_TOPIC_PATTERN =
  /\b(skill|skills|agent|agents|sdk|api|model|models|tool|tools|pricing|price|rate limit|limits|context window|release|releases|release notes|changelog|feature|features|version|versions|preview|deprecated|support|integration|computer use)\b/i;

interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export function extractGroundingSources(groundingMetadata: GroundingMetadata | null) {
  const chunks = groundingMetadata?.groundingChunks || [];

  const seen = new Set<string>();
  const sources: { uri: string; title: string }[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (typeof uri !== 'string' || !uri.trim() || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      uri,
      title:
        typeof chunk?.web?.title === 'string' && chunk.web.title.trim()
          ? chunk.web.title.trim()
          : uri,
    });
  }

  return sources;
}

export function shouldUseSearchGrounding(text: string) {
  if (!text) return false;

  if (RECENT_INFO_PATTERN.test(text)) {
    return true;
  }

  return (
    FAST_MOVING_TECH_BRAND_PATTERN.test(text) &&
    FAST_MOVING_TECH_TOPIC_PATTERN.test(text)
  );
}

function extractErrorMessage(payload: any, fallback: string) {
  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) {
    return payload.error.message.trim();
  }
  return fallback;
}

export async function generateContentWithGoogleSearch({
  apiKey,
  model,
  history = [],
  parts = [],
}: {
  apiKey: string;
  model: string;
  history?: any[];
  parts?: any[];
}) {
  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        contents: [
          ...history,
          {
            role: 'user',
            parts: Array.isArray(parts) && parts.length > 0 ? parts : [{ text: '' }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
      }
    );

    const payload = response.data;
    const candidate = payload?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';
    
    return {
      text,
      groundingMetadata: candidate?.groundingMetadata ?? null,
      groundingSources: extractGroundingSources(candidate?.groundingMetadata),
    };
  } catch (err: any) {
    const payload = err.response?.data || {};
    throw new Error(
      extractErrorMessage(payload, `Grounded request failed with status ${err.response?.status || 'unknown'}`)
    );
  }
}
