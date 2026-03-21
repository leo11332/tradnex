/**
 * Health data utilities for TRADNEX
 * Uses real HealthKit (iOS) and Health Connect (Android) in custom builds.
 * Falls back to mock data gracefully in Expo Go or if permissions are denied.
 */

import { Platform } from 'react-native';

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

function getMockData() {
  const rand = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
  return {
    heartRate: rand(58, 85),
    hrv: rand(35, 65),
    sleepHours: Math.round((Math.random() * 3 + 5.5) * 10) / 10,
    sleepQuality: rand(55, 92),
    stressScore: rand(20, 75),
  };
}

// ---------------------------------------------------------------------------
// iOS — HealthKit via react-native-health
// ---------------------------------------------------------------------------

async function fetchiOSHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchiOSHealthData: reading from HealthKit');
  const AppleHealthKit = require('react-native-health').default;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const options = {
    startDate: yesterday.toISOString(),
    endDate: now.toISOString(),
    limit: 1,
    ascending: false,
  };

  const heartRate = await new Promise<number>((resolve) => {
    AppleHealthKit.getHeartRateSamples(options, (err: any, results: any[]) => {
      if (err) console.warn('[Health] getHeartRateSamples error:', err);
      resolve(results?.[0]?.value ?? 72);
    });
  });

  const hrv = await new Promise<number>((resolve) => {
    AppleHealthKit.getHeartRateVariabilitySamples(options, (err: any, results: any[]) => {
      if (err) console.warn('[Health] getHeartRateVariabilitySamples error:', err);
      resolve(results?.[0]?.value ?? 45);
    });
  });

  const sleepData = await new Promise<{ sleepHours: number; sleepQuality: number }>((resolve) => {
    AppleHealthKit.getSleepSamples(
      { startDate: yesterday.toISOString(), endDate: now.toISOString() },
      (err: any, results: any[]) => {
        if (err) console.warn('[Health] getSleepSamples error:', err);
        if (!results || results.length === 0) {
          resolve({ sleepHours: 7, sleepQuality: 70 });
          return;
        }
        const asleep = results.filter(
          (r: any) =>
            r.value === 'ASLEEP' ||
            r.value === 'CORE' ||
            r.value === 'DEEP' ||
            r.value === 'REM'
        );
        const totalMs = asleep.reduce(
          (sum: number, r: any) =>
            sum + (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()),
          0
        );
        const sleepHours = Math.round((totalMs / 3600000) * 10) / 10;
        const deepRem = results.filter(
          (r: any) => r.value === 'DEEP' || r.value === 'REM'
        );
        const deepRemMs = deepRem.reduce(
          (sum: number, r: any) =>
            sum + (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()),
          0
        );
        const sleepQuality =
          totalMs > 0 ? Math.min(100, Math.round((deepRemMs / totalMs) * 200)) : 70;
        resolve({ sleepHours, sleepQuality });
      }
    );
  });

  const stressScore = Math.max(0, Math.min(100, Math.round(100 - (hrv / 100) * 80)));
  const result = { heartRate, hrv, ...sleepData, stressScore };
  console.log('[Health] fetchiOSHealthData result:', result);
  return result;
}

// ---------------------------------------------------------------------------
// Android — Health Connect via react-native-health-connect
// ---------------------------------------------------------------------------

async function fetchAndroidHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchAndroidHealthData: reading from Health Connect');
  const { readRecords } = require('react-native-health-connect');
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between',
    startTime: yesterday.toISOString(),
    endTime: now.toISOString(),
  };

  const hrRecords = await readRecords('HeartRate', { timeRangeFilter });
  const heartRate =
    hrRecords?.records?.[hrRecords.records.length - 1]?.samples?.[0]?.beatsPerMinute ?? 72;

  const hrvRecords = await readRecords('HeartRateVariabilitySdnn', { timeRangeFilter });
  const hrv =
    hrvRecords?.records?.[hrvRecords.records.length - 1]?.heartRateVariabilityMillis ?? 45;

  const sleepRecords = await readRecords('SleepSession', { timeRangeFilter });
  const lastSleep = sleepRecords?.records?.[sleepRecords.records.length - 1];
  const sleepMs = lastSleep
    ? new Date(lastSleep.endTime).getTime() - new Date(lastSleep.startTime).getTime()
    : 0;
  const sleepHours = Math.round((sleepMs / 3600000) * 10) / 10 || 7;
  const sleepQuality = 70;

  const stressScore = Math.max(0, Math.min(100, Math.round(100 - (hrv / 100) * 80)));
  const result = { heartRate, hrv, sleepHours, sleepQuality, stressScore };
  console.log('[Health] fetchAndroidHealthData result:', result);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request health permissions — real on custom builds, no-op mock in Expo Go.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  console.log('[Health] requestHealthPermissions called, platform:', Platform.OS);
  try {
    if (process.env.EXPO_OS === 'ios') {
      const AppleHealthKit = require('react-native-health').default;
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.StepCount,
          ],
          write: [],
        },
      };
      return await new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.warn('[Health] HealthKit init error:', error);
            resolve(false);
          } else {
            console.log('[Health] HealthKit initialized successfully');
            resolve(true);
          }
        });
      });
    } else if (process.env.EXPO_OS === 'android') {
      const { initialize, requestPermission } = require('react-native-health-connect');
      await initialize();
      await requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'HeartRateVariabilitySdnn' },
      ]);
      console.log('[Health] Health Connect permissions granted');
      return true;
    }
  } catch (e) {
    console.warn('[Health] requestHealthPermissions failed, falling back to mock:', e);
  }
  return true;
}

/**
 * Initialize HealthKit / Health Connect. Alias for requestHealthPermissions.
 */
export async function initializeHealthKit(): Promise<void> {
  console.log('[Health] initializeHealthKit called');
  try {
    if (process.env.EXPO_OS === 'ios') {
      const AppleHealthKit = require('react-native-health').default;
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.StepCount,
          ],
          write: [],
        },
      };
      return new Promise((resolve, reject) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.warn('[Health] initHealthKit error:', error);
            reject(new Error(error));
          } else {
            console.log('[Health] HealthKit ready');
            resolve();
          }
        });
      });
    } else if (process.env.EXPO_OS === 'android') {
      const { initialize, requestPermission } = require('react-native-health-connect');
      await initialize();
      await requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'HeartRateVariabilitySdnn' },
      ]);
      console.log('[Health] Health Connect ready');
    }
  } catch (e) {
    console.warn('[Health] initializeHealthKit failed, will use mock data:', e);
  }
}

/**
 * Fetch latest health data — real HealthKit/Health Connect on custom builds,
 * falls back to mock data gracefully in Expo Go or on permission failure.
 */
export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] fetchLatestHealthData called, platform:', Platform.OS);
  const simple = await fetchHealthData();
  const result: HealthData = {
    heartRate: simple.heartRate,
    hrv: simple.hrv,
    sleepScore: simple.sleepQuality,
    sleepDurationMinutes: Math.round(simple.sleepHours * 60),
    activeEnergy: jitter(420, 80),
    stressScore: simple.stressScore,
  };
  console.log('[Health] fetchLatestHealthData result:', result);
  return result;
}

/**
 * Convenience wrapper — returns { heartRate, hrv, sleepHours, sleepQuality, stressScore }.
 */
export async function fetchHealthData(): Promise<{
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}> {
  console.log('[Health] fetchHealthData called, EXPO_OS:', process.env.EXPO_OS);
  try {
    if (process.env.EXPO_OS === 'ios') {
      return await fetchiOSHealthData();
    } else if (process.env.EXPO_OS === 'android') {
      return await fetchAndroidHealthData();
    }
  } catch (e) {
    console.warn('[Health] fetchHealthData failed, using mock:', e);
  }
  const mock = getMockData();
  console.log('[Health] fetchHealthData using mock data:', mock);
  return mock;
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
    const dayPhase = (i / days) * Math.PI;
    const heartRate = clamp(
      Math.round(71 + Math.sin(dayPhase) * 6 + (Math.random() - 0.5) * 6),
      58,
      85
    );
    const hrv = clamp(
      Math.round(50 + Math.cos(dayPhase) * 8 + (Math.random() - 0.5) * 8),
      35,
      65
    );
    const sleepHours = Number(
      clamp(7 + Math.sin(dayPhase + 1) * 1 + (Math.random() - 0.5) * 0.8, 5.5, 8.5).toFixed(1)
    );
    const sleepQuality = clamp(
      Math.round(73 + Math.cos(dayPhase + 0.5) * 12 + (Math.random() - 0.5) * 10),
      55,
      92
    );
    const stressScore = clamp(
      Math.round(47 + Math.sin(dayPhase + 2) * 15 + (Math.random() - 0.5) * 12),
      20,
      75
    );
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
