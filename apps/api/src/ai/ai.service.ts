import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scrubMessagesForExternalAi, scrubTextForExternalAi } from './ai-pii.util';
import { readInstitutionAiSettings } from './ai-institution-settings';
import { AnthropicProvider } from './providers/anthropic.provider';
import type { AIProvider, ChatMessage } from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  async getSettings(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true },
    });
    const cfg = readInstitutionAiSettings(inst?.settings);
    return {
      aiProvider: cfg.aiProvider ?? null,
      hasOpenAiKey: Boolean(cfg.openaiApiKey),
      hasAnthropicKey: Boolean(cfg.anthropicApiKey),
      dailyTokenLimit: cfg.dailyTokenLimit ?? null,
      tutorDailyTokenLimit: cfg.tutorDailyTokenLimit ?? null,
    };
  }

  async resolveProvider(institutionId: string): Promise<AIProvider> {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true },
    });
    const cfg = readInstitutionAiSettings(inst?.settings);
    const preferred = cfg.aiProvider ?? process.env.AI_PROVIDER?.trim()?.toLowerCase();
    if (preferred === 'anthropic' && (cfg.anthropicApiKey || this.anthropic.isConfigured())) {
      return this.wrapWithKeys(this.anthropic, cfg);
    }
    if (cfg.openaiApiKey || this.openai.isConfigured()) {
      return this.wrapWithKeys(this.openai, cfg);
    }
    if (this.anthropic.isConfigured()) return this.wrapWithKeys(this.anthropic, cfg);
    throw new Error(
      'No AI provider configured (set institution BYOK or OPENAI_API_KEY / ANTHROPIC_API_KEY)',
    );
  }

  private wrapWithKeys(
    provider: AIProvider,
    cfg: ReturnType<typeof readInstitutionAiSettings>,
  ): AIProvider {
    const openaiKey = cfg.openaiApiKey ?? process.env.OPENAI_API_KEY?.trim();
    const anthropicKey = cfg.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
    return {
      name: provider.name,
      complete: (messages, options) =>
        provider.complete(scrubMessagesForExternalAi(messages), {
          ...options,
          apiKey: provider.name === 'openai' ? openaiKey : anthropicKey,
        }),
      stream: provider.stream
        ? (messages, options) =>
            provider.stream!(scrubMessagesForExternalAi(messages), {
              ...options,
              apiKey: provider.name === 'openai' ? openaiKey : anthropicKey,
            })
        : undefined,
      embed: (text, options) =>
        provider.embed(text, {
          ...options,
          apiKey: openaiKey,
        }),
    };
  }

  async complete(
    institutionId: string,
    messages: ChatMessage[],
    options?: { model?: string },
  ): Promise<string> {
    return (await this.resolveProvider(institutionId)).complete(messages, options);
  }

  async stream(
    institutionId: string,
    messages: ChatMessage[],
    options?: { model?: string },
  ): Promise<AsyncIterable<string>> {
    const provider = await this.resolveProvider(institutionId);
    const scrubbed = scrubMessagesForExternalAi(messages);
    if (!provider.stream) {
      const full = await provider.complete(scrubbed, options);
      async function* one() {
        yield full;
      }
      return one();
    }
    return provider.stream(scrubbed, options);
  }

  async embed(institutionId: string, text: string): Promise<number[]> {
    return (await this.resolveProvider(institutionId)).embed(scrubTextForExternalAi(text));
  }

  async analyticsNarrative(institutionId: string, entityId?: string) {
    const where = entityId ? { institutionId, entityId } : { institutionId };
    const [students, staff, meetings] = await Promise.all([
      this.prisma.student.count({ where: { ...where, deletedAt: null } }),
      this.prisma.staffProfile.count({ where: { ...where, deletedAt: null } }),
      this.prisma.meeting.count({ where: { ...where, deletedAt: null } }),
    ]);
    const narrative = await this.complete(institutionId, [
      {
        role: 'system',
        content: 'Write a concise executive narrative for university leadership.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          scope: entityId ?? 'institution-wide',
          students,
          staff,
          meetings,
        }),
      },
    ]);
    return { institutionId, entityId, narrative, isAIGenerated: true };
  }
}
