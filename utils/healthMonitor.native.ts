import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchHealthData } from './health';

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_THRESHOLDS = {
  stressMax: 70,
  heartRateMax: 100,
  hrvMin: 20,
  sleepQualityMin: 50,
  sleepHoursMin: 5.5,
};

export type Thresholds = typeof DEFAULT_THRESHOLDS;

async function getLastNotified(key: string): Promise<number> {
  const val = await AsyncStorage.getItem(`@tradnex_notif_${key}`);
  return val ? parseInt(val, 10) : 0;
}

async function setLastNotified(key: string): Promise<void> {
  await AsyncStorage.setItem(`@tradnex_notif_${key}`, Date.now().toString());
}

async function sendAlertIfNeeded(
  key: string,
  condition: boolean,
  title: string,
  body: string
): Promise<void> {
  if (!condition) return;
  const last = await getLastNotified(key);
  if (Date.now() - last < COOLDOWN_MS) {
    console.log(`[HealthMonitor] Skipping alert "${key}" — still in cooldown`);
    return;
  }
  console.log(`[HealthMonitor] Firing alert: ${key} — ${title}`);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
  await setLastNotified(key);
}

export async function checkThresholdsAndNotify(
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<void> {
  console.log('[HealthMonitor] checkThresholdsAndNotify called');
  try {
    const data = await fetchHealthData();
    console.log('[HealthMonitor] Health data fetched for threshold check:', data);

    await sendAlertIfNeeded(
      'stress',
      data.stressScore >= thresholds.stressMax,
      '🔴 Stress élevé détecté',
      'Réduisez votre exposition au marché et faites une pause.'
    );

    await sendAlertIfNeeded(
      'heartRate',
      data.heartRate >= thresholds.heartRateMax,
      '💓 Fréquence cardiaque élevée',
      'Votre cœur bat trop vite. Faites une pause avant de trader.'
    );

    await sendAlertIfNeeded(
      'hrv',
      data.hrv <= thresholds.hrvMin,
      '⚠️ HRV faible',
      'Votre système nerveux est sous tension. Prudence sur les marchés.'
    );

    await sendAlertIfNeeded(
      'sleepQuality',
      data.sleepQuality <= thresholds.sleepQualityMin,
      '😴 Mauvaise qualité de sommeil',
      "Prudence sur les marchés aujourd'hui — votre récupération est insuffisante."
    );

    const sleepHoursDisplay = Number(data.sleepHours).toFixed(1);
    await sendAlertIfNeeded(
      'sleepHours',
      data.sleepHours <= thresholds.sleepHoursMin,
      '😴 Sommeil insuffisant',
      `Seulement ${sleepHoursDisplay}h de sommeil. Évitez les trades à haut risque.`
    );
  } catch (e) {
    console.warn('[HealthMonitor] Threshold check failed:', e);
  }
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthMonitor(thresholds: Thresholds = DEFAULT_THRESHOLDS): void {
  if (monitorInterval) {
    console.log('[HealthMonitor] Already running, skipping start');
    return;
  }
  console.log('[HealthMonitor] Starting health monitor with thresholds:', thresholds);
  checkThresholdsAndNotify(thresholds);
  monitorInterval = setInterval(() => {
    console.log('[HealthMonitor] Poll interval fired');
    checkThresholdsAndNotify(thresholds);
  }, POLL_INTERVAL_MS);
}

export function stopHealthMonitor(): void {
  if (monitorInterval) {
    console.log('[HealthMonitor] Stopping health monitor');
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export function restartHealthMonitor(thresholds: Thresholds): void {
  console.log('[HealthMonitor] Restarting health monitor with new thresholds:', thresholds);
  stopHealthMonitor();
  startHealthMonitor(thresholds);
}
