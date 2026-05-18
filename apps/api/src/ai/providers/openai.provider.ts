import { Injectable } from '@nestjs/common';
import type { AIProvider, ChatMessage } from './ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private key(override?: string): string {
    const key = override?.trim() ?? process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    return key;
  }

  async complete(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): Promise<string> {
    const key = this.key(options?.apiKey);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
        messages,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? '';
  }

  async *stream(
    messages: ChatMessage[],
    options?: { model?: string; maxTokens?: number; apiKey?: string },
  ): AsyncIterable<string> {
    const key = this.key(options?.apiKey);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
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
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) yield chunk;
        } catch {
          /* skip malformed SSE lines */
        }
      }
    }
  }

  async embed(text: string, options?: { apiKey?: string }): Promise<number[]> {
    const key = this.key(options?.apiKey);
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return json.data?.[0]?.embedding ?? [];
  }
}
