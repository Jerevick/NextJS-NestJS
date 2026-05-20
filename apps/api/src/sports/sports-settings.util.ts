const DEFAULT_MINIMUM_GPA = 2.0;

export function readSportsMinimumGpa(settings: unknown): number {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return DEFAULT_MINIMUM_GPA;
  }
  const raw = (settings as { sportsMinimumGpa?: unknown }).sportsMinimumGpa;
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw >= 0 && raw <= 4) {
    return raw;
  }
  return DEFAULT_MINIMUM_GPA;
}
