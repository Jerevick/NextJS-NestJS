export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface AIProvider {
  readonly name: string;
  complete(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): Promise<string>;
  stream?(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): AsyncIterable<string>;
  embed(text: string, options?: { apiKey?: string }): Promise<number[]>;
}
