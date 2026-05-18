import { Injectable } from '@nestjs/common';
import type { AIProvider, ChatMessage } from './ai-provider.interface';

@Injectable()
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  async complete(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): Promise<string> {
    const key = options?.apiKey?.trim() ?? process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
    const system = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022',
        max_tokens: options?.maxTokens ?? 1024,
        system,
        messages: userMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    return json.content?.[0]?.text?.trim() ?? '';
  }

  async *stream(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): AsyncIterable<string> {
    const key = options?.apiKey?.trim() ?? process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
    const system = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022',
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
        system,
        messages: userMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  async embed(text: string, options?: { apiKey?: string }): Promise<number[]> {
    const openai = await import('./openai.provider');
    const fallback = new openai.OpenAIProvider();
    if (fallback.isConfigured()) return fallback.embed(text, options);
    throw new Error('Embeddings require OPENAI_API_KEY or pgvector offline mode');
  }
}
