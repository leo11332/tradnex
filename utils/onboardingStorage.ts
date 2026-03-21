import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ONBOARDING_KEY = 'tradnex_onboarding_complete';

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(ONBOARDING_KEY) === 'true';
    }
    const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return val === 'true';
  } catch {
    return true; // Default to complete to avoid blocking
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } else {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    }
  } catch {}
}
