/**
 * Health data utilities — web stub.
 * Native implementation is in health.native.ts (resolved by Metro on iOS/Android).
 */

export interface HealthData {
  heartRate: number | null;
  hrv: number | null;
  sleepScore: number | null;
  sleepDurationMinutes: number | null;
  activeEnergy: number | null;
  stressScore: number | null;
}

export function computeStressScore(
  _hrv: number | null,
  _heartRate: number | null,
  _activeEnergy: number | null
): number | null {
  return null;
}

export async function requestHealthPermissions(): Promise<boolean> {
  console.log('[Health] Health permissions not available on web');
  return false;
}

export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] Health data not available on web');
  return {
    heartRate: null,
    hrv: null,
    sleepScore: null,
    sleepDurationMinutes: null,
    activeEnergy: null,
    stressScore: null,
  };
}

export async function initializeHealthKit(): Promise<void> {
  console.log('[Health] initializeHealthKit not available on web');
}

export async function fetchHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchHealthData not available on web');
  return { heartRate: 72, hrv: 45, sleepHours: 7.2, sleepQuality: 78, stressScore: 35 };
}

export function startHealthPolling(
  _callback: (data: HealthData) => void,
  _intervalMs = 5 * 60 * 1000
): () => void {
  return () => {};
}
