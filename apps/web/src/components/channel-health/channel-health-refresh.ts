const HOUR_MS = 60 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;
const MANUAL_COOLDOWN_MS = 10 * 1000;

export function msUntilNextWholeHour(now: number): number {
  const remainder = now % HOUR_MS;
  return remainder === 0 ? HOUR_MS : HOUR_MS - remainder;
}

export function shouldRefreshOnVisibility(input: { lastLoadedAt: number; now: number }): boolean {
  return input.lastLoadedAt <= 0 || input.now - input.lastLoadedAt > STALE_AFTER_MS;
}

export function manualRefreshCoolingDown(input: { lastManualAt: number; now: number }): boolean {
  return input.lastManualAt > 0 && input.now - input.lastManualAt < MANUAL_COOLDOWN_MS;
}
