import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, Moon, Heart, Activity, Zap, RefreshCw, AlertTriangle } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { apiGet, apiPost } from "@/utils/api";
import { StressGauge } from "@/components/StressGauge";
import { SkeletonLine, SkeletonCard, SkeletonMetricCard } from "@/components/SkeletonLoader";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import {
  requestHealthPermissions,
  fetchLatestHealthData,
  startHealthPolling,
} from "@/utils/health";
import {
  formatRelativeDate,
  formatSleepDuration,
  getGreeting,
  formatDate,
} from "@/utils/dateUtils";

interface UserProfile {
  id: string;
  user_id: string;
  role: "user" | "admin";
  stress_threshold: number;
  heart_rate_threshold: number;
  subscription_status: "trial" | "active" | "expired" | "admin";
  trial_started_at: string | null;
  trial_days_remaining: number | null;
  created_at: string;
  updated_at: string;
}

interface LatestHealth {
  stress_score: number | null;
  heart_rate: number | null;
  hrv: number | null;
  sleep_score: number | null;
  sleep_duration_minutes: number | null;
  last_updated: string | null;
}

interface AIRecommendation {
  recommendation: string;
  severity: "optimal" | "caution" | "warning" | "danger";
}

const SEVERITY_COLORS: Record<string, string> = {
  optimal: COLORS.success,
  caution: COLORS.warning,
  warning: COLORS.warning,
  danger: COLORS.danger,
};

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}18`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: COLORS.text,
          fontFamily: "SpaceGrotesk-Bold",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          color: COLORS.textSecondary,
          letterSpacing: 1,
          fontFamily: "SpaceGrotesk-SemiBold",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 10,
          color: COLORS.textTertiary,
          fontFamily: "SpaceGrotesk-Regular",
          textAlign: "center",
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { isSubscribed } = useSubscription();
  const { sendTag } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [health, setHealth] = useState<LatestHealth | null>(null);
  const [aiRec, setAiRec] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const greeting = getGreeting();
  const todayStr = formatDate(new Date());
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Trader";

  const fetchAIRecommendation = useCallback(async (h: LatestHealth) => {
    if (!h.stress_score && !h.heart_rate && !h.hrv) return;
    setAiLoading(true);
    console.log("[Home] Fetching AI recommendation");
    try {
      const rec = await apiPost<AIRecommendation>("/api/ai/recommendation", {
        stress_score: h.stress_score,
        heart_rate: h.heart_rate,
        hrv: h.hrv,
        sleep_score: h.sleep_score,
        sleep_duration_minutes: h.sleep_duration_minutes,
      });
      setAiRec(rec);
      console.log("[Home] AI recommendation received:", rec.severity);
    } catch (err) {
      console.warn("[Home] AI recommendation failed:", err);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const checkThresholds = useCallback(
    (h: LatestHealth, p: UserProfile) => {
      if (!h || !p) return;
      const stressOver = h.stress_score !== null && h.stress_score > p.stress_threshold;
      const hrOver = h.heart_rate !== null && h.heart_rate > p.heart_rate_threshold;
      if (stressOver) {
        console.log("[Home] Stress threshold exceeded:", h.stress_score, ">", p.stress_threshold);
        sendTag("stress_alert", "true");
      }
      if (hrOver) {
        console.log("[Home] Heart rate threshold exceeded:", h.heart_rate, ">", p.heart_rate_threshold);
        sendTag("hr_alert", "true");
      }
    },
    [sendTag]
  );

  const loadData = useCallback(async () => {
    console.log("[Home] Loading dashboard data");
    try {
      const [profileData, healthData] = await Promise.all([
        apiGet<UserProfile>("/api/profile"),
        apiGet<LatestHealth>("/api/health/latest"),
      ]);
      setProfile(profileData);
      setHealth(healthData);
      checkThresholds(healthData, profileData);
      await fetchAIRecommendation(healthData);

      // Start trial if needed
      if (profileData.subscription_status === "trial" && !profileData.trial_started_at) {
        console.log("[Home] Starting trial");
        await apiPost("/api/profile/start-trial", {});
      }
    } catch (err) {
      console.error("[Home] Failed to load data:", err);
      setError("Couldn't load your health data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [fetchAIRecommendation, checkThresholds]);

  const syncHealthData = useCallback(async () => {
    console.log("[Home] Syncing health data from device");
    try {
      await requestHealthPermissions();
      const nativeData = await fetchLatestHealthData();
      if (nativeData.heartRate || nativeData.hrv || nativeData.sleepScore) {
        await apiPost("/api/health/entries", {
          stress_score: nativeData.stressScore,
          heart_rate: nativeData.heartRate,
          hrv: nativeData.hrv,
          sleep_score: nativeData.sleepScore,
          sleep_duration_minutes: nativeData.sleepDurationMinutes,
          source: "healthkit",
        });
        console.log("[Home] Health entry saved");
        setLastSynced(new Date().toISOString());
        // Refresh latest
        const updated = await apiGet<LatestHealth>("/api/health/latest");
        setHealth(updated);
        if (profile) checkThresholds(updated, profile);
        await fetchAIRecommendation(updated);
      }
    } catch (err) {
      console.warn("[Home] Health sync failed:", err);
    }
  }, [profile, checkThresholds, fetchAIRecommendation]);

  useEffect(() => {
    loadData().then(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      syncHealthData();
    });

    const stopPolling = startHealthPolling(async (data) => {
      console.log("[Home] Health poll callback");
      if (data.heartRate || data.hrv) {
        try {
          await apiPost("/api/health/entries", {
            stress_score: data.stressScore,
            heart_rate: data.heartRate,
            hrv: data.hrv,
            sleep_score: data.sleepScore,
            sleep_duration_minutes: data.sleepDurationMinutes,
            source: "healthkit",
          });
          const updated = await apiGet<LatestHealth>("/api/health/latest");
          setHealth(updated);
        } catch {}
      }
    });

    return stopPolling;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log("[Home] Manual refresh triggered");
    await loadData();
    await syncHealthData();
    setRefreshing(false);
  }, [loadData, syncHealthData]);

  const stressScore = health?.stress_score ?? null;
  const heartRate = health?.heart_rate ?? null;
  const hrv = health?.hrv ?? null;
  const sleepScore = health?.sleep_score ?? null;
  const sleepDuration = health?.sleep_duration_minutes ?? null;
  const lastUpdated = health?.last_updated ?? lastSynced;

  const heartRateStr = heartRate !== null ? `${heartRate}` : "--";
  const heartRateSub = lastUpdated ? formatRelativeDate(lastUpdated) : "No data";
  const hrvStr = hrv !== null ? `${hrv} ms` : "--";
  const sleepScoreStr = sleepScore !== null ? `${sleepScore}` : "--";
  const sleepDurStr = formatSleepDuration(sleepDuration);

  const trialDays = profile?.trial_days_remaining ?? null;
  const showTrialBanner = profile?.subscription_status === "trial" && trialDays !== null;

  const severityColor = aiRec ? SEVERITY_COLORS[aiRec.severity] ?? COLORS.primary : COLORS.primary;
  const severityLabel = aiRec?.severity?.toUpperCase() ?? "";

  if (error && !loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <AlertTriangle size={48} color={COLORS.danger} />
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700", marginTop: 16, fontFamily: "SpaceGrotesk-Bold", textAlign: "center" }}>
          Couldn't load your data
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center", fontFamily: "SpaceGrotesk-Regular" }}>
          {error}
        </Text>
        <AnimatedPressable
          onPress={() => { setError(null); setLoading(true); loadData(); }}
          style={{
            marginTop: 24,
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontFamily: "SpaceGrotesk-SemiBold" }}>Try Again</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 120,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <View>
              {loading ? (
                <>
                  <SkeletonLine width={160} height={22} style={{ marginBottom: 8 }} />
                  <SkeletonLine width={120} height={14} />
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "SpaceGrotesk-Bold" }}>
                    {greeting}, {firstName}
                  </Text>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontFamily: "SpaceGrotesk-Regular" }}>
                    {todayStr}
                  </Text>
                </>
              )}
            </View>
            <AnimatedPressable
              onPress={() => {
                console.log("[Home] Bell icon pressed");
                router.push("/notification-preferences");
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={20} color={COLORS.textSecondary} />
            </AnimatedPressable>
          </View>

          {/* Trial Banner */}
          {showTrialBanner && (
            <AnimatedPressable
              onPress={() => {
                console.log("[Home] Trial banner upgrade pressed");
                router.push("/paywall");
              }}
              style={{
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: 13, fontFamily: "SpaceGrotesk-Regular" }}>
                <Text style={{ fontWeight: "700", fontFamily: "SpaceGrotesk-Bold" }}>{trialDays} days</Text>
                {" "}left in your free trial
              </Text>
              <View style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", fontFamily: "SpaceGrotesk-Bold" }}>
                  Upgrade
                </Text>
              </View>
            </AnimatedPressable>
          )}

          {/* Stress Gauge */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            {loading ? (
              <View style={{ width: 240, height: 240, alignItems: "center", justifyContent: "center" }}>
                <SkeletonLine width={240} height={240} borderRadius={120} />
              </View>
            ) : (
              <StressGauge value={stressScore} size={240} />
            )}
          </View>

          {/* Metrics Row */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
            {loading ? (
              <>
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
              </>
            ) : (
              <>
                <MetricCard
                  icon={<Moon size={18} color={COLORS.accent} />}
                  label="SLEEP"
                  value={sleepScoreStr}
                  sub={sleepDurStr}
                  color={COLORS.accent}
                />
                <MetricCard
                  icon={<Heart size={18} color={COLORS.danger} />}
                  label="HEART RATE"
                  value={heartRateStr}
                  sub={heartRateSub}
                  color={COLORS.danger}
                />
                <MetricCard
                  icon={<Activity size={18} color={COLORS.success} />}
                  label="HRV"
                  value={hrvStr}
                  sub="Last night"
                  color={COLORS.success}
                />
              </>
            )}
          </View>

          {/* AI Recommendation Card */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderLeftWidth: 4,
              borderLeftColor: severityColor,
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Zap size={16} color={COLORS.primary} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary, letterSpacing: 1.5, fontFamily: "SpaceGrotesk-Bold" }}>
                    AI INSIGHT
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {aiRec && (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor: `${severityColor}20`,
                        borderWidth: 1,
                        borderColor: `${severityColor}40`,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: severityColor, letterSpacing: 1, fontFamily: "SpaceGrotesk-Bold" }}>
                        {severityLabel}
                      </Text>
                    </View>
                  )}
                  <AnimatedPressable
                    onPress={() => {
                      console.log("[Home] Refresh AI recommendation pressed");
                      if (health) fetchAIRecommendation(health);
                    }}
                    disabled={aiLoading}
                  >
                    <RefreshCw size={16} color={COLORS.textTertiary} />
                  </AnimatedPressable>
                </View>
              </View>

              {aiLoading || loading ? (
                <View style={{ gap: 8 }}>
                  <SkeletonLine width="100%" height={13} />
                  <SkeletonLine width="90%" height={13} />
                  <SkeletonLine width="70%" height={13} />
                </View>
              ) : aiRec ? (
                <Text style={{ fontSize: 14, color: COLORS.text, lineHeight: 22, fontFamily: "SpaceGrotesk-Regular" }}>
                  {aiRec.recommendation}
                </Text>
              ) : (
                <Text style={{ fontSize: 14, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
                  Sync your health data to get personalized AI insights.
                </Text>
              )}
            </View>
          </View>

          {/* Last synced */}
          {lastUpdated && (
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, textAlign: "center", fontFamily: "SpaceGrotesk-Regular" }}>
              Last synced {formatRelativeDate(lastUpdated)}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
