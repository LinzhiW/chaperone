// Claude adapter — wraps @anthropic-ai/sdk (Anthropic Messages API) behind the
// ModelProvider interface. Mirrors gemini.ts: nothing Anthropic-specific leaks
// above this file. Claude here is JUST A MODEL — plain Messages API with
// tool-use, NOT the Agent SDK. The pipeline (index.ts) still owns the loop,
// HITL, tools, and skills.

import Anthropic from '@anthropic-ai/sdk';
import { ChatSession, ModelProvider, ModelTurn, StartChatOptions, TokenUsage, ToolDef, ToolResult } from './types';

const DEFAULT_MAX_TOKENS = 16000;

// Adaptive thinking measurably helps multi-step tool use, and on Opus 4.7/4.8 and
// Sonnet 5 *omitting* `thinking` means the model does not think at all. But this is
// a bring-your-own-model tool: the user can put any string in ANTHROPIC_MODEL, and
// older models (Haiku 4.5 and earlier) reject `adaptive` with a 400. So we ask for
// it, and if a model refuses, we remember that model and stop asking.
const noAdaptiveThinking = new Set<string>();

function isThinkingRejection(err: any): boolean {
  if (err?.status !== 400) return false;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('thinking');
}

/**
 * Convert our provider-agnostic ToolDef (Gemini-shaped schema with uppercase
 * JSON-schema types like "OBJECT"/"STRING") into the Anthropic tool shape
 * (lowercase JSON Schema). The pipeline writes TOOL_DEFS once in Gemini's
 * dialect; this normalizes them for Claude.
 */
function toAnthropicTools(tools?: ToolDef[]): Anthropic.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: normalizeSchema(t.parameters) as Anthropic.Tool.InputSchema,
  }));
}

/** Recursively lowercase JSON-schema "type" values (OBJECT -> object, etc.). */
function normalizeSchema(schema: any): any {
  if (schema == null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(normalizeSchema);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'type' && typeof v === 'string') {
      out[k] = v.toLowerCase();
    } else if (k === 'properties' && v && typeof v === 'object') {
      out[k] = Object.fromEntries(
        Object.entries(v).map(([pk, pv]) => [pk, normalizeSchema(pv)]),
      );
    } else {
      out[k] = normalizeSchema(v);
    }
  }
  return out;
}

/** Normalize an Anthropic Message response into our common ModelTurn shape. */
function toTurn(message: Anthropic.Message): ModelTurn {
  let text = '';
  const toolCalls: ModelTurn['toolCalls'] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({ name: block.name, args: (block.input as Record<string, any>) || {} });
    }
  }
  const u = message.usage;
  return {
    text,
    toolCalls,
    ...(u ? { usage: { input: u.input_tokens || 0, output: u.output_tokens || 0,
                       ...(u.cache_read_input_tokens ? { cached: u.cache_read_input_tokens } : {}) } } : {}),
  };
}

/**
 * Convert provider-agnostic history (Gemini-shaped: { role: 'user'|'model',
 * parts: [{ text }] }) into Anthropic messages. Best-effort — only text parts
 * are carried over, which is all the PM chat uses.
 */
function toAnthropicHistory(history?: any[]): Anthropic.MessageParam[] {
  if (!history || history.length === 0) return [];
  const msgs: Anthropic.MessageParam[] = [];
  for (const h of history) {
    const role: 'user' | 'assistant' = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
    let text = '';
    if (typeof h.content === 'string') text = h.content;
    else if (Array.isArray(h.parts)) text = h.parts.map((p: any) => p.text || '').join('');
    else if (Array.isArray(h.content)) text = h.content.map((p: any) => p.text || '').join('');
    if (text) msgs.push({ role, content: text });
  }
  return msgs;
}

class ClaudeChatSession implements ChatSession {
  private messages: Anthropic.MessageParam[];
  // Tracks the tool_use ids from the last assistant turn so tool results can be
  // matched back by name -> id (the pipeline only sends back name + result).
  private pendingToolUses: { id: string; name: string }[] = [];

  constructor(
    private client: Anthropic,
    private model: string,
    private system: string | undefined,
    private tools: Anthropic.Tool[] | undefined,
    history?: Anthropic.MessageParam[],
  ) {
    this.messages = history ? [...history] : [];
  }

  private async run(): Promise<ModelTurn> {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: DEFAULT_MAX_TOKENS,
      ...(this.system ? { system: this.system } : {}),
      ...(this.tools ? { tools: this.tools } : {}),
      messages: this.messages,
    };

    let message: Anthropic.Message;
    if (noAdaptiveThinking.has(this.model)) {
      message = await this.client.messages.create(params);
    } else {
      try {
        message = await this.client.messages.create({ ...params, thinking: { type: 'adaptive' } });
      } catch (err) {
        if (!isThinkingRejection(err)) throw err;
        noAdaptiveThinking.add(this.model);
        message = await this.client.messages.create(params);
      }
    }

    // Persist the assistant turn so the conversation stays coherent and any
    // tool_use blocks survive for the matching tool_result on the next call.
    this.messages.push({ role: 'assistant', content: message.content });
    this.pendingToolUses = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: b.name }));

    return toTurn(message);
  }

  async sendMessage(text: string): Promise<ModelTurn> {
    this.messages.push({ role: 'user', content: text });
    return this.run();
  }

  async sendToolResults(results: ToolResult[]): Promise<ModelTurn> {
    const used = new Set<string>();
    const blocks: Anthropic.ToolResultBlockParam[] = results.map(r => {
      // Match this result to a pending tool_use id by name (first unused).
      const match = this.pendingToolUses.find(p => p.name === r.name && !used.has(p.id));
      if (match) used.add(match.id);
      return {
        type: 'tool_result' as const,
        tool_use_id: match ? match.id : (this.pendingToolUses[0]?.id ?? r.name),
        content: r.result,
      };
    });
    this.messages.push({ role: 'user', content: blocks });
    return this.run();
  }
}

export class ClaudeProvider implements ModelProvider {
  readonly id = 'claude';
  readonly modelLabel: string;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    // Match the OpenAI adapter: generous timeout + retries, because model calls
    // here often go through a local proxy/VPN and can be slow or flaky.
    // (TypeScript SDK timeouts are milliseconds.)
    this.client = new Anthropic({ apiKey, timeout: 120000, maxRetries: 4 });
    this.model = model;
    this.modelLabel = model;
  }

  startChat(opts: StartChatOptions): ChatSession {
    return new ClaudeChatSession(
      this.client,
      this.model,
      opts.system,
      toAnthropicTools(opts.tools),
      toAnthropicHistory(opts.history),
    );
  }

  async generateOnce(prompt: string): Promise<{ text: string; usage?: TokenUsage }> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    const u = message.usage;
    return {
      text: message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim(),
      ...(u ? { usage: { input: u.input_tokens || 0, output: u.output_tokens || 0,
                         ...(u.cache_read_input_tokens ? { cached: u.cache_read_input_tokens } : {}) } } : {}),
    };
  }
}
