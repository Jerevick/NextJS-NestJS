import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { parseQuizJson } from './ai-content.util';
import { scrubTextForExternalAi } from './ai-pii.util';

@Injectable()
export class AiContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private lessonText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') return JSON.stringify(content);
    return '';
  }

  async summarizeLesson(institutionId: string, lessonId: string, override?: string) {
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const body = scrubTextForExternalAi(override?.trim() || this.lessonText(lesson.content));
    const summary = await this.ai.complete(institutionId, [
      {
        role: 'system',
        content:
          'Summarize this lesson for faculty planning. End with a "Key points" bullet list (3–6 items).',
      },
      { role: 'user', content: `${lesson.title}\n\n${body}`.slice(0, 12000) },
    ]);
    const keyPoints = extractBulletKeyPoints(summary);
    const existing = await this.prisma.lmsContentSummary.findFirst({
      where: { lessonId, institutionId },
    });
    if (existing) {
      await this.prisma.lmsContentSummary.update({
        where: { id: existing.id },
        data: {
          summary,
          keyPoints: keyPoints as unknown as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.lmsContentSummary.create({
        data: {
          lessonId,
          institutionId,
          summary,
          keyPoints: keyPoints as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return { lessonId, summary, keyPoints, isAIGenerated: true };
  }

  async generateQuiz(
    institutionId: string,
    lessonId: string,
    count = 5,
    difficulty = 'medium',
    override?: string,
  ) {
    const lesson = await this.prisma.lmsLesson.findFirst({
      where: { id: lessonId, institutionId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const body = scrubTextForExternalAi(override?.trim() || this.lessonText(lesson.content));
    const raw = await this.ai.complete(institutionId, [
      {
        role: 'system',
        content:
          'Return valid JSON only: { "questions": [{ "prompt", "options": string[], "answerIndex": number }] }',
      },
      {
        role: 'user',
        content:
          `Lesson: ${lesson.title}\nDifficulty: ${difficulty}\nCount: ${count}\n\n${body}`.slice(
            0,
            10000,
          ),
      },
    ]);
    try {
      const { questions } = parseQuizJson(raw);
      return {
        lessonId,
        count: questions.length,
        difficulty,
        questions,
        isAIGenerated: true,
      };
    } catch {
      return { lessonId, questions: raw, isAIGenerated: true, parseError: true };
    }
  }
}

function extractBulletKeyPoints(summary: string): string[] {
  const lines = summary.split('\n');
  const points: string[] = [];
  let inBullets = false;
  for (const line of lines) {
    if (/key points/i.test(line)) {
      inBullets = true;
      continue;
    }
    if (inBullets && /^[-*•]\s+/.test(line.trim())) {
      points.push(line.replace(/^[-*•]\s+/, '').trim());
    }
  }
  return points.slice(0, 8);
}
