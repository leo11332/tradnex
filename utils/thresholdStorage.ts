import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THRESHOLDS, Thresholds } from './healthMonitor';

const KEY = '@tradnex_thresholds';

export async function saveThresholds(t: Thresholds): Promise<void> {
  console.log('[ThresholdStorage] Saving thresholds:', t);
  await AsyncStorage.setItem(KEY, JSON.stringify(t));
}

export async function loadThresholds(): Promise<Thresholds> {
  console.log('[ThresholdStorage] Loading thresholds');
  const val = await AsyncStorage.getItem(KEY);
  const result = val ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(val) } : DEFAULT_THRESHOLDS;
  console.log('[ThresholdStorage] Loaded thresholds:', result);
  return result;
}
