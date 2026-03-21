import React, { useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/TradnexColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { setOnboardingComplete } from "@/utils/onboardingStorage";
import { Activity, TrendingUp, Bell, Zap } from "lucide-react-native";

const FEATURES = [
  {
    icon: <Activity size={28} color={COLORS.primary} />,
    title: "Real-Time Health Monitoring",
    desc: "Live stress, HRV, and heart rate from HealthKit & Health Connect",
  },
  {
    icon: <Zap size={28} color={COLORS.accent} />,
    title: "AI Trading Recommendations",
    desc: "Personalized advice based on your biometric data",
  },
  {
    icon: <TrendingUp size={28} color={COLORS.success} />,
    title: "Performance History",
    desc: "30-day charts for stress, sleep, and HRV trends",
  },
  {
    icon: <Bell size={28} color={COLORS.warning} />,
    title: "Smart Alerts",
    desc: "Instant notifications when stress or heart rate exceeds your thresholds",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleGetStarted = async () => {
    console.log("[Onboarding] Get started pressed");
    await setOnboardingComplete();
    router.replace("/paywall");
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
      }}
    >
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <Text
            style={{
              fontSize: 36,
              fontWeight: "700",
              color: COLORS.primary,
              letterSpacing: 6,
              fontFamily: "SpaceGrotesk-Bold",
            }}
          >
            TRADNEX
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: COLORS.textSecondary,
              marginTop: 10,
              textAlign: "center",
              fontFamily: "SpaceGrotesk-Regular",
              lineHeight: 22,
            }}
          >
            Trade with clarity.{"\n"}Perform at your peak.
          </Text>
        </View>

        {/* Features */}
        <View style={{ gap: 16, flex: 1 }}>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 14,
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {f.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: COLORS.text,
                    fontFamily: "SpaceGrotesk-Bold",
                    marginBottom: 4,
                  }}
                >
                  {f.title}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: COLORS.textSecondary,
                    fontFamily: "SpaceGrotesk-Regular",
                    lineHeight: 19,
                  }}
                >
                  {f.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <AnimatedPressable
          onPress={handleGetStarted}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            height: 54,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "700",
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: 0.5,
            }}
          >
            Get Started
          </Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}
