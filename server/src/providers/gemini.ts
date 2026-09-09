// Gemini adapter — wraps @google/genai behind the ModelProvider interface.
// Nothing Gemini-specific leaks above this file.
//
// Uses @google/genai, not the older @google/generative-ai. The old SDK sends tool
// results with role "function", which current Gemini models reject outright
// ("Role 'function' is not supported"). Plain chat still worked on the old SDK, so
// the breakage only showed up once an agent actually used a tool — which is most
// of what this app does.

import { GoogleGenAI } from '@google/genai';
import { ChatSession, ModelProvider, ModelTurn, StartChatOptions, TokenUsage, ToolResult } from './types';

// Same budget the Claude/OpenAI adapters use — these calls often go through a
// local proxy/VPN and the SDK default is short enough to cut off real work.
const REQUEST_TIMEOUT_MS = 120000;

function usageOf(r: any): TokenUsage | undefined {
  const u = r?.usageMetadata;
  if (!u) return undefined;
  return {
    input: u.promptTokenCount || 0,
    // Reasoning tokens are billed as output but reported separately.
    output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
    ...(u.cachedContentTokenCount ? { cached: u.cachedContentTokenCount } : {}),
  };
}

/** Normalize a Gemini response into our common ModelTurn shape. */
function toTurn(r: any): ModelTurn {
  let text = '';
  try { text = r?.text || ''; } catch { text = ''; }
  const calls = r?.functionCalls || [];
  const usage = usageOf(r);
  return {
    text,
    toolCalls: calls.map((c: any) => ({ name: c.name, args: c.args || {} })),
    ...(usage ? { usage } : {}),
  };
}

/** Our provider-agnostic history is already Gemini-shaped: { role, parts }. */
function toHistory(history?: any[]): any[] {
  if (!Array.isArray(history)) return [];
  return history
    .map(h => ({
      role: h.role === 'assistant' ? 'model' : h.role === 'model' ? 'model' : 'user',
      parts: Array.isArray(h.parts) ? h.parts : [{ text: String(h.content ?? '') }],
    }))
    .filter(h => h.parts.length > 0);
}

class GeminiChatSession implements ChatSession {
  constructor(private chat: any) {}

  async sendMessage(text: string): Promise<ModelTurn> {
    return toTurn(await this.chat.sendMessage({ message: text }));
  }

  async sendToolResults(results: ToolResult[]): Promise<ModelTurn> {
    const parts = results.map(r => ({
      functionResponse: { name: r.name, response: { result: r.result } },
    }));
    return toTurn(await this.chat.sendMessage({ message: parts }));
  }
}

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini';
  readonly modelLabel: string;
  private ai: GoogleGenAI;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
    this.modelId = modelId;
    this.modelLabel = modelId;
  }

  startChat(opts: StartChatOptions): ChatSession {
    const chat = this.ai.chats.create({
      model: this.modelId,
      ...(opts.history ? { history: toHistory(opts.history) } : {}),
      config: {
        ...(opts.tools ? { tools: [{ functionDeclarations: opts.tools as any }] } : {}),
        ...(opts.system ? { systemInstruction: opts.system } : {}),
      },
    });
    return new GeminiChatSession(chat);
  }

  async generateOnce(prompt: string): Promise<{ text: string; usage?: TokenUsage }> {
    const r: any = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
    });
    const usage = usageOf(r);
    return { text: (r?.text || '').trim(), ...(usage ? { usage } : {}) };
  }
}
