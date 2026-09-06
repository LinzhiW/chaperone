// Model-provider interface (TODO P1).
//
// The ONLY job of a provider is to normalize a vendor's chat + function-calling
// API into one common shape: messages in -> text/tool-calls out. It does NOT own
// the agent loop, the tools, HITL, or skills — those live in the pipeline
// (index.ts) and are identical for every model. Adding a vendor = one small
// adapter; the pipeline never changes. See PRD §5.

export interface ToolDef {
  name: string;
  description: string;
  parameters: any;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  name: string;
  result: string;
}

/**
 * Tokens a single request actually consumed, as reported by the provider.
 * This is measured, not estimated — cost estimates are derived from it, but the
 * counts themselves are ground truth and are shown even when we have no price
 * for the model.
 */
export interface TokenUsage {
  input: number;
  output: number;
  /** Input tokens served from cache, where the provider distinguishes them. */
  cached?: number;
}

/** One model turn, normalized: either plain text, tool calls, or both. */
export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
  usage?: TokenUsage;
}

export interface StartChatOptions {
  system?: string;
  tools?: ToolDef[];
  history?: any[];
}

/** A multi-turn chat session (used by the worker loop and PM chat). */
export interface ChatSession {
  /** Send a user message; get the model's next turn. */
  sendMessage(text: string): Promise<ModelTurn>;
  /** Send tool-execution results back; get the model's next turn. */
  sendToolResults(results: ToolResult[]): Promise<ModelTurn>;
}

export interface ModelProvider {
  /** stable id, e.g. "gemini" */
  readonly id: string;
  /** human label for UI / logs, e.g. "gemini-2.5-flash" */
  readonly modelLabel: string;
  /** start a multi-turn chat (worker loop, PM chat) */
  startChat(opts: StartChatOptions): ChatSession;
  /** one-shot generation (reviewer). Returns usage so it can be metered like chat turns. */
  generateOnce(prompt: string): Promise<{ text: string; usage?: TokenUsage }>;
}
