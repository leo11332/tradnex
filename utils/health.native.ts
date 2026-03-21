/**
 * Health data utilities for TRADNEX
 * iOS: react-native-health (HealthKit)
 * Android: react-native-health-connect (Health Connect)
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

/**
 * Request health permissions (iOS HealthKit / Android Health Connect)
 */
export async function requestHealthPermissions(): Promise<boolean> {
  console.log('[Health] Requesting health permissions');
  try {
    if (process.env.EXPO_OS === 'ios') {
      const AppleHealthKit = require('react-native-health').default;
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          ],
          write: [],
        },
      };
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (err: Error) => {
          if (err) {
            console.warn('[Health] HealthKit permission denied:', err.message);
            resolve(false);
          } else {
            console.log('[Health] HealthKit permissions granted');
            resolve(true);
          }
        });
      });
    } else if (process.env.EXPO_OS === 'android') {
      const { initialize, requestPermission } = require('react-native-health-connect');
      await initialize();
      const granted = await requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'HeartRateVariability' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
      console.log('[Health] Health Connect permissions:', granted);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Health] Permission request failed:', err);
    return false;
  }
}

/**
 * Fetch latest health data from native APIs
 */
export async function fetchLatestHealthData(): Promise<HealthData> {
  console.log('[Health] Fetching latest health data');
  const result: HealthData = {
    heartRate: null,
    hrv: null,
    sleepScore: null,
    sleepDurationMinutes: null,
    activeEnergy: null,
    stressScore: null,
  };

  try {
    if (process.env.EXPO_OS === 'ios') {
      const AppleHealthKit = require('react-native-health').default;
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const options = {
        startDate: yesterday.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
        ascending: false,
      };

      await new Promise<void>((resolve) => {
        AppleHealthKit.getHeartRateSamples(options, (err: Error, samples: Array<{ value: number }>) => {
          if (!err && samples?.length > 0) {
            result.heartRate = Math.round(samples[0].value);
          }
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        AppleHealthKit.getHeartRateVariabilitySamples(options, (err: Error, samples: Array<{ value: number }>) => {
          if (!err && samples?.length > 0) {
            result.hrv = Math.round(samples[0].value);
          }
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        AppleHealthKit.getSleepSamples(
          { startDate: yesterday.toISOString(), endDate: now.toISOString() },
          (err: Error, samples: Array<{ startDate: string; endDate: string; value: string }>) => {
            if (!err && samples?.length > 0) {
              const asleepSamples = samples.filter(
                (s) => s.value === 'ASLEEP' || s.value === 'CORE' || s.value === 'DEEP' || s.value === 'REM'
              );
              const totalMs = asleepSamples.reduce((acc, s) => {
                return acc + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
              }, 0);
              result.sleepDurationMinutes = Math.round(totalMs / 60000);
              const hours = result.sleepDurationMinutes / 60;
              result.sleepScore = Math.min(100, Math.round((hours / 8) * 100));
            }
            resolve();
          }
        );
      });

      await new Promise<void>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(options, (err: Error, samples: Array<{ value: number }>) => {
          if (!err && samples?.length > 0) {
            result.activeEnergy = Math.round(samples[0].value);
          }
          resolve();
        });
      });
    } else if (process.env.EXPO_OS === 'android') {
      const { readRecords } = require('react-native-health-connect');
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const timeRangeFilter = {
        operator: 'between',
        startTime: yesterday.toISOString(),
        endTime: now.toISOString(),
      };

      try {
        const hrRecords = await readRecords('HeartRate', { timeRangeFilter });
        if (hrRecords?.records?.length > 0) {
          const latest = hrRecords.records[hrRecords.records.length - 1];
          result.heartRate = Math.round(latest.samples?.[0]?.beatsPerMinute ?? 0);
        }
      } catch {}

      try {
        const hrvRecords = await readRecords('HeartRateVariability', { timeRangeFilter });
        if (hrvRecords?.records?.length > 0) {
          const latest = hrvRecords.records[hrvRecords.records.length - 1];
          result.hrv = Math.round(latest.rmssd ?? 0);
        }
      } catch {}

      try {
        const sleepRecords = await readRecords('SleepSession', { timeRangeFilter });
        if (sleepRecords?.records?.length > 0) {
          const latest = sleepRecords.records[sleepRecords.records.length - 1];
          const durationMs = new Date(latest.endTime).getTime() - new Date(latest.startTime).getTime();
          result.sleepDurationMinutes = Math.round(durationMs / 60000);
          result.sleepScore = Math.min(100, Math.round((result.sleepDurationMinutes / 480) * 100));
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[Health] Failed to fetch health data:', err);
  }

  result.stressScore = computeStressScore(result.hrv, result.heartRate, result.activeEnergy);
  console.log('[Health] Fetched data:', result);
  return result;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling health data every intervalMs milliseconds
 */
export function startHealthPolling(
  callback: (data: HealthData) => void,
  intervalMs = 5 * 60 * 1000
): () => void {
  console.log('[Health] Starting health polling, interval:', intervalMs);
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
