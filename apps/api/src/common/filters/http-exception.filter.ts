import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const path = req.url?.split('?')[0] ?? req.path ?? '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (isRecord(body) && typeof body.message === 'string') {
        message = body.message;
      } else if (isRecord(body) && Array.isArray(body.message)) {
        message = (body.message as string[]).join('; ');
      } else {
        message = exception.message;
      }
      if (isRecord(body) && typeof body.errorCode === 'string' && body.errorCode.length > 0) {
        errorCode = body.errorCode;
      } else {
        errorCode = HttpStatus[status] ?? 'HTTP_EXCEPTION';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.CONFLICT;
      message = 'Database constraint or integrity error';
      errorCode = 'DATABASE_ERROR';
      this.log.warn(`Prisma error on ${path}: ${exception.code}`);
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
      this.log.error(exception.stack ?? exception.message);
    }

    res.status(status).json({
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path,
    });
  }
}
