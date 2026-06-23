// OpenAI adapter — wraps the OpenAI Chat Completions API behind ModelProvider.
// Same shape as gemini.ts / claude.ts. Used when OPENAI_API_KEY is set.
// GPT handles non-English (e.g. Chinese) well, unlike gemini-2.5-flash.

import OpenAI from 'openai';
import { ChatSession, ModelProvider, ModelTurn, StartChatOptions, ToolDef, ToolResult } from './types';

// Our TOOL_DEFS use Gemini-style uppercase JSON-schema types (OBJECT/STRING).
// OpenAI wants standard lowercase JSON Schema — recursively lowercase `type`.
function lc(schema: any): any {
  if (Array.isArray(schema)) return schema.map(lc);
  if (schema && typeof schema === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(schema)) out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : lc(v);
    return out;
  }
  return schema;
}

function toOpenAITools(tools?: ToolDef[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: lc(t.parameters) },
  }));
}

const safeParse = (s: string) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

// Convert the frontend's Gemini-style history [{role:'user'|'model', parts:[{text}]}]
// (or {role, content}) into OpenAI messages.
function histToMessages(history?: any[]): any[] {
  if (!Array.isArray(history)) return [];
  return history.map(h => {
    const role = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = h.parts ? h.parts.map((p: any) => p?.text || '').join('') : (h.content || '');
    return { role, content };
  });
}

class OpenAIChatSession implements ChatSession {
  private messages: any[] = [];
  private lastToolCalls: any[] = [];
  constructor(private client: OpenAI, private model: string, system?: string, private tools?: any[], history?: any[]) {
    if (system) this.messages.push({ role: 'system', content: system });
    this.messages.push(...histToMessages(history));
  }

  private async run(): Promise<ModelTurn> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
      ...(this.tools ? { tools: this.tools } : {}),
    });
    const msg: any = resp.choices[0].message;
    this.messages.push(msg);
    this.lastToolCalls = (msg.tool_calls || []).map((c: any) => ({ ...c, _used: false }));
    return {
      text: msg.content || '',
      toolCalls: (msg.tool_calls || []).map((tc: any) => ({ name: tc.function.name, args: safeParse(tc.function.arguments) })),
    };
  }

  async sendMessage(text: string): Promise<ModelTurn> {
    this.messages.push({ role: 'user', content: text });
    return this.run();
  }

  async sendToolResults(results: ToolResult[]): Promise<ModelTurn> {
    for (const r of results) {
      const tc = this.lastToolCalls.find((c: any) => c.function.name === r.name && !c._used) || this.lastToolCalls.find((c: any) => c.function.name === r.name);
      if (tc) tc._used = true;
      this.messages.push({ role: 'tool', tool_call_id: tc?.id, content: r.result });
    }
    return this.run();
  }
}

export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai';
  readonly modelLabel: string;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.modelLabel = model;
  }

  startChat(opts: StartChatOptions): ChatSession {
    return new OpenAIChatSession(this.client, this.model, opts.system, toOpenAITools(opts.tools), opts.history);
  }

  async generateOnce(prompt: string): Promise<string> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return (resp.choices[0].message.content || '').trim();
  }
}
