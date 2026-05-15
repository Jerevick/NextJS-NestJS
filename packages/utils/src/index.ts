import { setTimeout as delay } from 'node:timers/promises';

export function assertDefined<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Expected value to be defined');
  }
  return value;
}

export function sleep(ms: number): Promise<void> {
  return delay(ms);
}
