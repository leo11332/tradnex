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

/** Clamp a value between min and max */
function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
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
 * Ranges: heartRate 58-85, hrv 35-65, sleep 5.5-8.5h, sleepQuality 55-92, stress 20-75.
 */
export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] fetchLatestHealthData called (mock)');

  const heartRate = clamp(jitter(71, 14), 58, 85);
  const hrv = clamp(jitter(50, 15), 35, 65);
  const sleepHoursRaw = 7 + (Math.random() - 0.5) * 3; // 5.5–8.5
  const sleepDurationMinutes = clamp(Math.round(sleepHoursRaw * 60), 330, 510);
  const sleepScore = clamp(jitter(73, 18), 55, 92);
  const activeEnergy = jitter(420, 80);
  const stressScore = clamp(jitter(47, 27), 20, 75);

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
 * Convenience wrapper — returns { heartRate, hrv, sleepHours, sleepQuality, stressScore }.
 * Ranges: heartRate 58-85, hrv 35-65, sleepHours 5.5-8.5, sleepQuality 55-92, stressScore 20-75.
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
  const sleepHours = Number((clamp(raw.sleepDurationMinutes ?? 420, 330, 510) / 60).toFixed(1));
  return {
    heartRate: clamp(raw.heartRate ?? 71, 58, 85),
    hrv: clamp(raw.hrv ?? 50, 35, 65),
    sleepHours,
    sleepQuality: clamp(raw.sleepScore ?? 73, 55, 92),
    stressScore: clamp(raw.stressScore ?? 47, 20, 75),
  };
}

/**
 * Generate 7 days of mock historical health entries for seeding charts.
 * Each day varies realistically around baseline values.
 */
export function generateMockHistory(days = 7): {
  date: string;
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}[] {
  console.log('[Health] generateMockHistory called, days:', days);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    // Use a seeded-ish pattern so adjacent days are correlated
    const dayPhase = (i / days) * Math.PI;
    const heartRate = clamp(Math.round(71 + Math.sin(dayPhase) * 6 + (Math.random() - 0.5) * 6), 58, 85);
    const hrv = clamp(Math.round(50 + Math.cos(dayPhase) * 8 + (Math.random() - 0.5) * 8), 35, 65);
    const sleepHours = Number((clamp(7 + Math.sin(dayPhase + 1) * 1 + (Math.random() - 0.5) * 0.8, 5.5, 8.5)).toFixed(1));
    const sleepQuality = clamp(Math.round(73 + Math.cos(dayPhase + 0.5) * 12 + (Math.random() - 0.5) * 10), 55, 92);
    const stressScore = clamp(Math.round(47 + Math.sin(dayPhase + 2) * 15 + (Math.random() - 0.5) * 12), 20, 75);
    result.push({ date, heartRate, hrv, sleepHours, sleepQuality, stressScore });
  }
  return result;
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
