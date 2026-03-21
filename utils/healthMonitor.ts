// Web stub — health monitoring with local notifications is native-only.
// All real logic lives in healthMonitor.native.ts

export const DEFAULT_THRESHOLDS = {
  stressMax: 70,
  heartRateMax: 100,
  hrvMin: 20,
  sleepQualityMin: 50,
  sleepHoursMin: 5.5,
};

export type Thresholds = typeof DEFAULT_THRESHOLDS;

export async function checkThresholdsAndNotify(
  _thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<void> {
  // no-op on web
}

export function startHealthMonitor(_thresholds: Thresholds = DEFAULT_THRESHOLDS): void {
  // no-op on web
}

export function stopHealthMonitor(): void {
  // no-op on web
}

export function restartHealthMonitor(_thresholds: Thresholds): void {
  // no-op on web
}
