/**
 * Health data utilities — web stub with jittered mock data.
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

function jitter(base: number, range: number): number {
  return Math.round(base + (Math.random() - 0.5) * range * 2);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function computeStressScore(
  hrv: number | null,
  heartRate: number | null,
  _activeEnergy: number | null
): number | null {
  if (hrv === null && heartRate === null) return null;
  const hrvVal = hrv ?? 50;
  const hrVal = heartRate ?? 70;
  const raw = 100 - hrvVal / 2 + (hrVal - 60) * 0.5;
  return clamp(Math.round(raw), 0, 100);
}

export async function requestHealthPermissions(): Promise<boolean> {
  console.log('[Health] Health permissions not available on web');
  return false;
}

export async function initializeHealthKit(): Promise<void> {
  console.log('[Health] initializeHealthKit not available on web');
}

export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] fetchLatestHealthData called (web mock)');
  const heartRate = clamp(jitter(71, 14), 58, 85);
  const hrv = clamp(jitter(50, 15), 35, 65);
  const sleepHoursRaw = 7 + (Math.random() - 0.5) * 3;
  const sleepDurationMinutes = clamp(Math.round(sleepHoursRaw * 60), 330, 510);
  const sleepScore = clamp(jitter(73, 18), 55, 92);
  const activeEnergy = jitter(420, 80);
  const stressScore = clamp(jitter(47, 27), 20, 75);
  const result: HealthData = { heartRate, hrv, sleepScore, sleepDurationMinutes, activeEnergy, stressScore };
  console.log('[Health] Web mock health data:', result);
  return result;
}

export async function fetchHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchHealthData called (web mock)');
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

export function generateMockHistory(days = 7): {
  date: string;
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}[] {
  console.log('[Health] generateMockHistory called (web), days:', days);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
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

export function startHealthPolling(
  _callback: (data: HealthData) => void,
  _intervalMs = 5 * 60 * 1000
): () => void {
  return () => {};
}
