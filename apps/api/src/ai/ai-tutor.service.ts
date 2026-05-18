import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { LmsStudentEligibilityService } from '../lms/lms-student-eligibility.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { EmbeddingsService } from './embeddings.service';
import { estimateTokens } from './ai-token.util';
import { resolveTutorDailyTokenLimit } from './ai-tutor-token.util';
import type { ChatMessage } from './providers/ai-provider.interface';

export type TutorCitation = {
  sourceType: string;
  sourceId: string;
  title: string;
  lessonId?: string;
};

export type TutorTurnResult = {
  reply: string;
  citations: TutorCitation[];
  tokensUsed: number;
  tokensRemaining: number | null;
  dailyTokenLimit: number | null;
  isAIGenerated: true;
};

const SOCRATIC_SYSTEM = `You are a Socratic AI tutor for university learners.

Rules:
- Guide the student toward understanding; do not give full final answers on graded work.
- Ask clarifying questions and suggest next steps.
- Use only the provided course materials; if missing, say so honestly.
- When you use a source, mention it by its lesson title in parentheses, e.g. (see: "Week 3 — Intro").
- Keep responses concise and encouraging.`;

@Injectable()
export class AiTutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly embeddings: EmbeddingsService,
    private readonly eligibility: LmsStudentEligibilityService,
  ) {}

  async chat(user: AuthUser, courseInstanceId: string, message: string): Promise<TutorTurnResult> {
    const student = await this.assertAccess(user, courseInstanceId);
    const budget = student
      ? await this.loadTokenBudget(user.institutionId, student.id)
      : { limit: null, used: 0, remaining: null };

    const { messages, citations } = await this.buildContext(
      user,
      courseInstanceId,
      message,
      student?.id,
    );
    const reply = await this.ai.complete(user.institutionId, messages);
    const tokens = estimateTokens(message) + estimateTokens(reply);
    if (student) {
      await this.persistSession(
        student,
        user.institutionId,
        courseInstanceId,
        message,
        reply,
        tokens,
      );
    }

    return {
      reply,
      citations,
      tokensUsed: tokens,
      tokensRemaining: budget.remaining != null ? Math.max(0, budget.remaining - tokens) : null,
      dailyTokenLimit: budget.limit,
      isAIGenerated: true,
    };
  }

  async *streamChat(
    user: AuthUser,
    courseInstanceId: string,
    message: string,
  ): AsyncGenerator<{
    chunk?: string;
    done?: boolean;
    citations?: TutorCitation[];
    tokensUsed?: number;
    tokensRemaining?: number | null;
    dailyTokenLimit?: number | null;
  }> {
    const student = await this.assertAccess(user, courseInstanceId);
    const budget = student
      ? await this.loadTokenBudget(user.institutionId, student.id)
      : { limit: null, used: 0, remaining: null };

    const { messages, citations } = await this.buildContext(
      user,
      courseInstanceId,
      message,
      student?.id,
    );
    let full = '';
    for await (const chunk of await this.ai.stream(user.institutionId, messages)) {
      full += chunk;
      yield { chunk };
    }
    const tokens = estimateTokens(message) + estimateTokens(full);
    if (student) {
      await this.persistSession(
        student,
        user.institutionId,
        courseInstanceId,
        message,
        full,
        tokens,
      );
    }
    yield {
      done: true,
      citations,
      tokensUsed: tokens,
      tokensRemaining: budget.remaining != null ? Math.max(0, budget.remaining - tokens) : null,
      dailyTokenLimit: budget.limit,
    };
  }

  private async assertAccess(
    user: AuthUser,
    courseInstanceId: string,
  ): Promise<{ id: string } | null> {
    await this.eligibility.assertStudentEnrolledForCourseInstance(
      user,
      courseInstanceId,
      user.entityId ?? undefined,
    );
    if (user.role === 'STUDENT') {
      const student = await this.prisma.student.findFirst({
        where: { userId: user.userId, institutionId: user.institutionId, deletedAt: null },
      });
      if (!student) throw new ForbiddenException('Student profile required for AI tutor');
      await this.eligibility.assertMayUseStudentLms(user);
      return student;
    }
    if (user.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: user.studentId, institutionId: user.institutionId, deletedAt: null },
      });
      return student;
    }
    return null;
  }

  private async loadTokenBudget(institutionId: string, studentId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true, plan: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    const limit = resolveTutorDailyTokenLimit(inst.settings, inst.plan);
    if (!limit) return { limit: null, used: 0, remaining: null };

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const sessions = await this.prisma.lmsAiTutorSession.findMany({
      where: { studentId, institutionId, createdAt: { gte: startOfDay } },
      select: { tokensUsed: true },
    });
    const used = sessions.reduce((s, row) => s + row.tokensUsed, 0);
    if (used >= limit) {
      throw new PayloadTooLargeException(
        `Daily AI tutor token limit reached (${limit} tokens per day)`,
      );
    }
    return { limit, used, remaining: limit - used };
  }

  private async buildContext(
    user: AuthUser,
    courseInstanceId: string,
    message: string,
    studentId: string | undefined,
  ) {
    const lessonIds = await this.enrolledCourseLessonIds(user, courseInstanceId);
    const chunks =
      lessonIds.length > 0
        ? (
            await this.embeddings.similaritySearch({
              institutionId: user.institutionId,
              entityId: user.entityId ?? undefined,
              courseInstanceId,
              sourceIds: lessonIds,
              query: message,
              topK: 5,
              sourceTypes: ['lesson', 'lms_module'],
            })
          ).data
        : [];

    const citations = await this.resolveCitations(chunks);
    const context =
      chunks.length > 0
        ? chunks
            .map((c, i) => {
              const cite = citations.find(
                (x) => x.sourceId === c.sourceId && x.sourceType === c.sourceType,
              );
              return `[${i + 1}] ${cite?.title ?? c.sourceId}\n${c.content}`;
            })
            .join('\n---\n')
        : '(No embedded course materials yet for this class.)';

    const history = studentId ? await this.priorMessages(studentId, courseInstanceId) : [];
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${SOCRATIC_SYSTEM}\n\nCourse materials:\n${context}`,
      },
      ...history,
      { role: 'user', content: message },
    ];
    return { messages, citations };
  }

  private async resolveCitations(
    chunks: Array<{ sourceType: string; sourceId: string; metadata: unknown }>,
  ): Promise<TutorCitation[]> {
    const lessonIds = chunks.filter((c) => c.sourceType === 'lesson').map((c) => c.sourceId);
    const lessons = lessonIds.length
      ? await this.prisma.lmsLesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleById = new Map(lessons.map((l) => [l.id, l.title]));

    return chunks.map((c) => {
      const meta = (c.metadata ?? {}) as { title?: string };
      const title = meta.title ?? titleById.get(c.sourceId) ?? c.sourceId;
      return {
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        title,
        ...(c.sourceType === 'lesson' ? { lessonId: c.sourceId } : {}),
      };
    });
  }

  private async priorMessages(studentId: string, courseInstanceId: string): Promise<ChatMessage[]> {
    const session = await this.prisma.lmsAiTutorSession.findFirst({
      where: { studentId, courseInstanceId },
      orderBy: { createdAt: 'desc' },
    });
    const raw = (session?.messages as Array<{ role: string; content: string }>) ?? [];
    return raw
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }

  private async enrolledCourseLessonIds(
    user: AuthUser,
    courseInstanceId: string,
  ): Promise<string[]> {
    const ci = await this.prisma.lmsCourseInstance.findFirst({
      where: {
        id: courseInstanceId,
        institutionId: user.institutionId,
        deletedAt: null,
      },
      select: { section: { select: { entityId: true } } },
    });
    if (!ci) return [];

    const modules = await this.prisma.lmsModule.findMany({
      where: {
        courseInstanceId,
        institutionId: user.institutionId,
        deletedAt: null,
        isPublished: true,
      },
      select: {
        lessons: {
          where: { deletedAt: null, isPublished: true },
          select: { id: true },
        },
      },
    });
    return modules.flatMap((m) => m.lessons.map((l) => l.id));
  }

  private async persistSession(
    student: { id: string },
    institutionId: string,
    courseInstanceId: string,
    userMessage: string,
    assistantReply: string,
    tokens: number,
  ): Promise<void> {
    const existing = await this.prisma.lmsAiTutorSession.findFirst({
      where: { studentId: student.id, courseInstanceId },
      orderBy: { createdAt: 'desc' },
    });
    const prior = (existing?.messages as Array<{ role: string; content: string }>) ?? [];
    const messages = [
      ...prior,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantReply },
    ].slice(-40);
    if (existing) {
      await this.prisma.lmsAiTutorSession.update({
        where: { id: existing.id },
        data: { messages, tokensUsed: { increment: tokens } },
      });
    } else {
      await this.prisma.lmsAiTutorSession.create({
        data: {
          studentId: student.id,
          institutionId,
          courseInstanceId,
          messages,
          tokensUsed: tokens,
        },
      });
    }
  }
}
