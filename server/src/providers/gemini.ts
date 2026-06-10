// Gemini adapter — wraps @google/generative-ai behind the ModelProvider interface.
// This is the reference adapter; Claude/GPT/DeepSeek follow the same shape (TODO P2/P5).
// Nothing Gemini-specific leaks above this file.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatSession, ModelProvider, ModelTurn, StartChatOptions, ToolResult } from './types';

/** Normalize a Gemini result into our common ModelTurn shape. */
function toTurn(result: any): ModelTurn {
  const response = result.response;
  const calls = (response.functionCalls && response.functionCalls()) || [];
  let text = '';
  try { text = response.text() || ''; } catch { text = ''; }
  return {
    text,
    toolCalls: calls.map((c: any) => ({ name: c.name, args: c.args || {} })),
  };
}

class GeminiChatSession implements ChatSession {
  constructor(private chat: any) {}

  async sendMessage(text: string): Promise<ModelTurn> {
    return toTurn(await this.chat.sendMessage(text));
  }

  async sendToolResults(results: ToolResult[]): Promise<ModelTurn> {
    const parts = results.map(r => ({
      functionResponse: { name: r.name, response: { result: r.result } },
    }));
    return toTurn(await this.chat.sendMessage(parts));
  }
}

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini';
  readonly modelLabel: string;
  private genAI: GoogleGenerativeAI;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelId = modelId;
    this.modelLabel = modelId;
  }

  startChat(opts: StartChatOptions): ChatSession {
    const model = this.genAI.getGenerativeModel({
      model: this.modelId,
      ...(opts.tools ? { tools: [{ functionDeclarations: opts.tools }] } : {}),
      ...(opts.system ? { systemInstruction: opts.system } : {}),
    } as any);
    const chat = model.startChat(opts.history ? { history: opts.history } : {});
    return new GeminiChatSession(chat);
  }

  async generateOnce(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.modelId });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }
}
