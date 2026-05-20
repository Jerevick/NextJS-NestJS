import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function pickFields<T extends Record<string, unknown>>(
  row: T,
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in row) out[f] = row[f];
  }
  return out;
}

/**
 * Supports `?fields=a,b,c` on list endpoints that return `{ records: [...] }`.
 * Mobile clients use this to reduce payload size.
 */
@Injectable()
export class FieldsSelectionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ query?: { fields?: string } }>();
    const raw = req.query?.fields?.trim();
    if (!raw) {
      return next.handle();
    }
    const fields = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!fields.length) {
      return next.handle();
    }

    return next.handle().pipe(
      map((body) => {
        if (!body || typeof body !== 'object') return body;
        const b = body as { records?: unknown[] };
        if (!Array.isArray(b.records)) return body;
        return {
          ...b,
          records: b.records.map((row) =>
            row && typeof row === 'object' && !Array.isArray(row)
              ? pickFields(row as Record<string, unknown>, fields)
              : row,
          ),
        };
      }),
    );
  }
}
