/** Apply institution/entity student number template (supports `{year}`, `{code}`, `{seq}`, `[SEQ:N]`, `YYYY`). */
export function applyStudentNumberFormat(
  template: string,
  ctx: { year: number; code: string; seq: number },
): string {
  const safeCode = ctx.code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'PG';
  let out = template
    .replaceAll('{year}', String(ctx.year))
    .replaceAll('YYYY', String(ctx.year))
    .replaceAll('{code}', safeCode);

  const seqToken = out.match(/\[SEQ:(\d+)\]/i);
  if (seqToken) {
    const width = Math.min(12, Math.max(1, Number(seqToken[1]) || 4));
    out = out.replace(/\[SEQ:\d+\]/i, String(ctx.seq).padStart(width, '0'));
  }

  if (out.includes('{seq}')) {
    out = out.replaceAll('{seq}', String(ctx.seq).padStart(3, '0'));
  }

  return out;
}
