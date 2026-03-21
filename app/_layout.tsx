import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { COLORS } from "@/constants/TradnexColors";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

const TradnexDarkTheme = {
  dark: true,
  colors: {
    primary: "#0EA5E9",
    background: "#080B0F",
    card: "#0F1419",
    text: "#F0F4F8",
    border: "rgba(14,165,233,0.12)",
    notification: "#0EA5E9",
  },
};

function NavigationGuard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;
    const isAuthRoute =
      pathname === "/auth-screen" ||
      pathname === "/auth-popup" ||
      pathname === "/auth-callback" ||
      pathname === "/paywall";
    if (!user && !isAuthRoute) {
      console.log("[Nav] No user, redirecting to auth-screen");
      router.replace("/auth-screen");
    }
  }, [user, authLoading, pathname]);

  return null;
}

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: "700",
          color: COLORS.primary,
          letterSpacing: 4,
          fontFamily: "SpaceGrotesk-Bold",
        }}
      >
        TRADNEX
      </Text>
    </View>
  );
}

function AppContent() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NavigationGuard />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth-popup"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="paywall"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="notification-preferences"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    "SpaceGrotesk-Regular": require("@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf"),
    "SpaceGrotesk-Medium": require("@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf"),
    "SpaceGrotesk-SemiBold": require("@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={TradnexDarkTheme}>
          <AuthProvider>
            <SubscriptionProvider>
              <NotificationProvider>
                <StatusBar style="light" animated />
                <SystemBars style="light" />
                <AppContent />
              </NotificationProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
