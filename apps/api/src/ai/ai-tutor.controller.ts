import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TutorAccessGuard } from './guards/tutor-access.guard';
import { TutorMessageDto } from './dto/tutor-message.dto';
import { AiTutorService } from './ai-tutor.service';

/** Student-facing Socratic tutor with course-scoped RAG (Prompt 13.1). */
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('ai/tutor')
@UseGuards(TutorAccessGuard)
export class AiTutorController {
  constructor(private readonly tutor: AiTutorService) {}

  /** Spec: POST /ai/tutor/:courseInstanceId/message → SSE streaming */
  @Post(':courseInstanceId/message')
  async message(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: TutorMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.pipeSse(user, courseInstanceId, dto.message, res);
  }

  /** Alias for clients that target /stream explicitly. */
  @Post(':courseInstanceId/stream')
  async streamPost(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: TutorMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.pipeSse(user, courseInstanceId, dto.message, res);
  }

  /** Non-streaming JSON fallback (e.g. integrations). */
  @Post(':courseInstanceId/chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Param('courseInstanceId') courseInstanceId: string,
    @Body() dto: TutorMessageDto,
  ) {
    return this.tutor.chat(user, courseInstanceId, dto.message);
  }

  private async pipeSse(
    user: AuthUser,
    courseInstanceId: string,
    message: string,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    try {
      for await (const event of this.tutor.streamChat(user, courseInstanceId, message)) {
        if (event.chunk) {
          res.write(`data: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
        }
        if (event.done) {
          res.write(
            `data: ${JSON.stringify({
              done: true,
              citations: event.citations,
              tokensUsed: event.tokensUsed,
              tokensRemaining: event.tokensRemaining,
              dailyTokenLimit: event.dailyTokenLimit,
              isAIGenerated: true,
            })}\n\n`,
          );
        }
      }
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: String(e) })}\n\n`);
    }
    res.end();
  }
}
