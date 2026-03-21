/**
 * Health data utilities for TRADNEX
 * Uses realistic mock data — compatible with Expo Go (no custom native build required).
 * Replace with a real health SDK (e.g. expo-health) once a custom dev client is available.
 */

export interface HealthData {
  heartRate: number | null;
  hrv: number | null;
  sleepScore: number | null;
  sleepDurationMinutes: number | null;
  activeEnergy: number | null;
  stressScore: number | null;
}

/**
 * Compute stress score 0-100 from HRV, heart rate, and active energy.
 * Lower HRV + higher HR = higher stress.
 */
export function computeStressScore(
  hrv: number | null,
  heartRate: number | null,
  activeEnergy: number | null
): number | null {
  if (hrv === null && heartRate === null) return null;
  const hrvVal = hrv ?? 50;
  const hrVal = heartRate ?? 70;
  const raw = 100 - hrvVal / 2 + (hrVal - 60) * 0.5;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Small random jitter so mock data feels live across calls */
function jitter(base: number, range: number): number {
  return Math.round(base + (Math.random() - 0.5) * range * 2);
}

/**
 * Request health permissions — resolves successfully in Expo Go (no-op mock).
 */
export async function requestHealthPermissions(): Promise<boolean> {
  console.log('[Health] requestHealthPermissions called (mock — Expo Go compatible)');
  return true;
}

/** Alias used by some callers */
export async function initializeHealthKit(): Promise<void> {
  console.log('[Health] initializeHealthKit called (mock — Expo Go compatible)');
}

/**
 * Fetch latest health data — returns realistic mock values.
 */
export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] fetchLatestHealthData called (mock)');

  const heartRate = jitter(72, 8);
  const hrv = jitter(45, 10);
  const sleepDurationMinutes = jitter(432, 30); // ~7.2 h ± 30 min
  const sleepScore = Math.min(100, Math.round((sleepDurationMinutes / 480) * 100));
  const activeEnergy = jitter(420, 80);
  const stressScore = computeStressScore(hrv, heartRate, activeEnergy);

  const result: HealthData = {
    heartRate,
    hrv,
    sleepScore,
    sleepDurationMinutes,
    activeEnergy,
    stressScore,
  };

  console.log('[Health] Mock health data:', result);
  return result;
}

/**
 * Convenience wrapper matching the shape requested by the task.
 * Returns { heartRate, hrv, sleepHours, sleepQuality, stressScore }.
 */
export async function fetchHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchHealthData called (mock)');
  const raw = await fetchLatestHealthData();
  return {
    heartRate: raw.heartRate ?? 72,
    hrv: raw.hrv ?? 45,
    sleepHours: Number(((raw.sleepDurationMinutes ?? 432) / 60).toFixed(1)),
    sleepQuality: raw.sleepScore ?? 78,
    stressScore: raw.stressScore ?? 35,
  };
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling health data every intervalMs milliseconds.
 */
export function startHealthPolling(
  callback: (data: HealthData) => void,
  intervalMs = 5 * 60 * 1000
): () => void {
  console.log('[Health] startHealthPolling started, interval:', intervalMs);
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  pollingInterval = setInterval(async () => {
    const data = await fetchLatestHealthData();
    callback(data);
  }, intervalMs);

  return () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };
}
