export type EntityHrSettings = {
  maxCreditHoursPerSemester?: number;
  blockWorkloadOverMax?: boolean;
};

export function parseEntityHrSettings(settings: unknown): EntityHrSettings {
  if (!settings || typeof settings !== 'object') return {};
  const root = settings as Record<string, unknown>;
  const hr = root.hr;
  if (!hr || typeof hr !== 'object') return {};
  const h = hr as Record<string, unknown>;
  return {
    maxCreditHoursPerSemester:
      typeof h.maxCreditHoursPerSemester === 'number' ? h.maxCreditHoursPerSemester : undefined,
    blockWorkloadOverMax: h.blockWorkloadOverMax === true,
  };
}

/** Evenly redistribute credit hours across staff under capacity. */
export function suggestWorkloadDistribution(
  rows: Array<{
    staffId: string;
    staffNumber: string;
    totalCreditHours: number;
    maxCreditHours: number;
  }>,
  totalHoursToAssign: number,
): Array<{ staffId: string; suggestedCreditHours: number; note: string }> {
  if (rows.length === 0 || totalHoursToAssign <= 0) return [];
  const sorted = [...rows].sort(
    (a, b) =>
      a.totalCreditHours / Math.max(1, a.maxCreditHours) -
      b.totalCreditHours / Math.max(1, b.maxCreditHours),
  );
  const suggestions: Array<{ staffId: string; suggestedCreditHours: number; note: string }> = [];
  let remaining = totalHoursToAssign;
  for (const row of sorted) {
    if (remaining <= 0) break;
    const headroom = Math.max(0, row.maxCreditHours - row.totalCreditHours);
    if (headroom <= 0) continue;
    const add = Math.min(headroom, Math.ceil(remaining / sorted.length));
    suggestions.push({
      staffId: row.staffId,
      suggestedCreditHours: row.totalCreditHours + add,
      note: `${row.staffNumber}: +${add}h (utilization target)`,
    });
    remaining -= add;
  }
  return suggestions;
}
