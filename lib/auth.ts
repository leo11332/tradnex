import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SUPABASE_URL = "https://qrewqcxevhyelykulfqv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyZXdxY3hldmh5ZWx5a3VsZnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTUzNzksImV4cCI6MjA4OTEzMTM3OX0.O0JqTMYw3CUNgkeSDMrowKwDa68GW5YvEPkB682mPRg";

// Custom storage adapter using expo-secure-store on native, localStorage on web
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(key)
        : null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
