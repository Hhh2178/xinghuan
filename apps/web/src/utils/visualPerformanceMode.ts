export type VisualPerformanceMode = 'default' | 'reduced';

export interface VisualPerformanceSignals {
  prefersReducedMotion: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

export function resolveVisualPerformanceMode({
  prefersReducedMotion,
  hardwareConcurrency,
  deviceMemory,
}: VisualPerformanceSignals): VisualPerformanceMode {
  if (prefersReducedMotion) return 'reduced';
  if (typeof hardwareConcurrency === 'number' && hardwareConcurrency > 0 && hardwareConcurrency <= 4) {
    return 'reduced';
  }
  if (typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 4) {
    return 'reduced';
  }
  return 'default';
}

export function detectVisualPerformanceMode(
  targetWindow: Window,
  targetNavigator: Navigator,
): VisualPerformanceMode {
  const media = typeof targetWindow.matchMedia === 'function'
    ? targetWindow.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  return resolveVisualPerformanceMode({
    prefersReducedMotion: Boolean(media?.matches),
    hardwareConcurrency: targetNavigator.hardwareConcurrency,
    deviceMemory: (targetNavigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
}

export function applyVisualPerformanceMode(root: HTMLElement, mode: VisualPerformanceMode) {
  if (mode === 'reduced') {
    root.dataset.performanceMode = 'reduced';
    return;
  }
  delete root.dataset.performanceMode;
}
