import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Bell,
  Heart,
  Activity,
  LogOut,
  RefreshCw,
  Crown,
  CheckCircle,
  AlertCircle,
  Star,
  ChevronRight,
  Moon,
  Zap,
} from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { apiGet, apiPut, apiPost } from "@/utils/api";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import {
  requestHealthPermissions,
  fetchLatestHealthData,
} from "@/utils/health";
import { formatRelativeDate } from "@/utils/dateUtils";
import { DEFAULT_THRESHOLDS, Thresholds, restartHealthMonitor } from "@/utils/healthMonitor";
import { saveThresholds, loadThresholds } from "@/utils/thresholdStorage";

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

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: COLORS.textTertiary,
        letterSpacing: 1.5,
        fontFamily: "SpaceGrotesk-Bold",
        marginBottom: 10,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: COLORS.divider,
        marginHorizontal: 16,
      }}
    />
  );
}

interface AlertSliderRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  accentColor: string;
  onValueChange: (v: number) => void;
}

function AlertSliderRow({
  icon,
  label,
  value,
  unit,
  min,
  max,
  step,
  accentColor,
  onValueChange,
}: AlertSliderRowProps) {
  const displayValue = step < 1 ? Number(value).toFixed(1) : String(Math.round(value));
  const labelText = label + " " + displayValue + unit;
  return (
    <View style={{ paddingVertical: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-SemiBold",
            }}
          >
            {label}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: `${accentColor}18`,
            borderWidth: 1,
            borderColor: `${accentColor}30`,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: accentColor,
              fontFamily: "SpaceGrotesk-Bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {labelText}
          </Text>
        </View>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor={COLORS.surfaceElevated}
        thumbTintColor={accentColor}
        step={step}
      />
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}
      >
        <Text
          style={{
            fontSize: 10,
            color: COLORS.textTertiary,
            fontFamily: "SpaceGrotesk-Regular",
          }}
        >
          {step < 1 ? Number(min).toFixed(1) : String(min)}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: COLORS.textTertiary,
            fontFamily: "SpaceGrotesk-Regular",
          }}
        >
          {step < 1 ? Number(max).toFixed(1) : String(max)}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [stressThreshold, setStressThreshold] = useState(70);
  const [hrThreshold, setHrThreshold] = useState(100);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local notification thresholds
  const [localThresholds, setLocalThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [alertSaveSuccess, setAlertSaveSuccess] = useState(false);
  const alertSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile();
    loadSavedThresholds();
  }, []);

  const loadSavedThresholds = async () => {
    console.log("[Settings] Loading saved alert thresholds");
    const t = await loadThresholds();
    setLocalThresholds(t);
  };

  const loadProfile = async () => {
    console.log("[Settings] Loading profile");
    try {
      const p = await apiGet<UserProfile>("/api/profile");
      setProfile(p);
      setStressThreshold(p.stress_threshold ?? 70);
      setHrThreshold(p.heart_rate_threshold ?? 100);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (err) {
      console.error("[Settings] Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const persistAlertThresholds = useCallback(async (t: Thresholds) => {
    console.log("[Settings] Persisting alert thresholds:", t);
    await saveThresholds(t);
    restartHealthMonitor(t);
    setAlertSaveSuccess(true);
    if (alertSaveTimer.current) clearTimeout(alertSaveTimer.current);
    alertSaveTimer.current = setTimeout(() => setAlertSaveSuccess(false), 2000);
  }, []);

  const handleAlertThresholdChange = useCallback(
    (key: keyof Thresholds, val: number) => {
      const updated = { ...localThresholds, [key]: val };
      setLocalThresholds(updated);
      if (alertSaveTimer.current) clearTimeout(alertSaveTimer.current);
      alertSaveTimer.current = setTimeout(() => persistAlertThresholds(updated), 600);
    },
    [localThresholds, persistAlertThresholds]
  );

  const saveProfileThresholds = useCallback(
    async (stress: number, hr: number) => {
      setSaving(true);
      console.log("[Settings] Saving profile thresholds", { stress, hr });
      try {
        await apiPut("/api/profile", {
          stress_threshold: stress,
          heart_rate_threshold: hr,
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        console.log("[Settings] Profile thresholds saved");
      } catch (err) {
        console.error("[Settings] Failed to save profile thresholds:", err);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleStressChange = (val: number) => {
    const rounded = Math.round(val);
    setStressThreshold(rounded);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProfileThresholds(rounded, hrThreshold), 800);
  };

  const handleHrChange = (val: number) => {
    const rounded = Math.round(val);
    setHrThreshold(rounded);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProfileThresholds(stressThreshold, rounded), 800);
  };

  const handleSyncHealth = async () => {
    setSyncing(true);
    console.log("[Settings] Manual health sync triggered");
    try {
      await requestHealthPermissions();
      const data = await fetchLatestHealthData();
      if (data.heartRate || data.hrv || data.sleepScore) {
        await apiPost("/api/health/entries", {
          stress_score: data.stressScore,
          heart_rate: data.heartRate,
          hrv: data.hrv,
          sleep_score: data.sleepScore,
          sleep_duration_minutes: data.sleepDurationMinutes,
          source: "healthkit",
        });
        setLastSynced(new Date().toISOString());
        console.log("[Settings] Health data synced");
      }
    } catch (err) {
      console.error("[Settings] Health sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    console.log("[Settings] Sign out pressed");
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            console.log("[Settings] Sign out confirmed");
            await signOut();
            router.replace("/auth-screen");
          },
        },
      ]
    );
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "T";

  const subStatus = profile?.subscription_status ?? "trial";
  const trialDays = profile?.trial_days_remaining;

  const subStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    trial: {
      label: trialDays !== null ? `Free Trial — ${trialDays} days remaining` : "Free Trial",
      color: COLORS.primary,
      icon: <Crown size={18} color={COLORS.primary} />,
    },
    active: {
      label: "Pro — Active",
      color: COLORS.success,
      icon: <CheckCircle size={18} color={COLORS.success} />,
    },
    expired: {
      label: "Trial Expired",
      color: COLORS.danger,
      icon: <AlertCircle size={18} color={COLORS.danger} />,
    },
    admin: {
      label: "Admin Access",
      color: COLORS.gold,
      icon: <Star size={18} color={COLORS.gold} />,
    },
  };

  const subConfig = subStatusConfig[subStatus] ?? subStatusConfig.trial;

  const stressColor =
    stressThreshold < 40 ? COLORS.success : stressThreshold <= 70 ? COLORS.warning : COLORS.danger;
  const hrColor =
    hrThreshold < 80 ? COLORS.success : hrThreshold <= 120 ? COLORS.warning : COLORS.danger;

  const roleLabel = profile?.role === "admin" ? "ADMIN" : subStatus === "active" ? "PRO" : "TRIAL";
  const roleColor = profile?.role === "admin" ? COLORS.gold : subStatus === "active" ? COLORS.success : COLORS.primary;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 120,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: -0.5,
            }}
          >
            Settings
          </Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Profile Section */}
          <SectionTitle title="PROFILE" />
          <SectionCard>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: COLORS.primaryMuted,
                  borderWidth: 2,
                  borderColor: COLORS.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: COLORS.primary,
                    fontFamily: "SpaceGrotesk-Bold",
                  }}
                >
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                {loading ? (
                  <>
                    <SkeletonLine width={120} height={16} style={{ marginBottom: 6 }} />
                    <SkeletonLine width={160} height={12} />
                  </>
                ) : (
                  <>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: COLORS.text,
                        fontFamily: "SpaceGrotesk-Bold",
                      }}
                    >
                      {user?.name ?? "Trader"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: COLORS.textSecondary,
                        marginTop: 2,
                        fontFamily: "SpaceGrotesk-Regular",
                      }}
                    >
                      {user?.email ?? ""}
                    </Text>
                  </>
                )}
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: `${roleColor}18`,
                  borderWidth: 1,
                  borderColor: `${roleColor}40`,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: roleColor,
                    letterSpacing: 1,
                    fontFamily: "SpaceGrotesk-Bold",
                  }}
                >
                  {roleLabel}
                </Text>
              </View>
            </View>
          </SectionCard>

          {/* Alert Thresholds */}
          <SectionTitle title="ALERT THRESHOLDS" />
          <SectionCard>
            <View style={{ padding: 16 }}>
              {/* Stress Threshold */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Activity size={16} color={stressColor} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "SpaceGrotesk-SemiBold" }}>
                      Stress Alert
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: `${stressColor}18`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: stressColor,
                        fontFamily: "SpaceGrotesk-Bold",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      Alert at {stressThreshold}
                    </Text>
                  </View>
                </View>
                <Slider
                  minimumValue={0}
                  maximumValue={100}
                  value={stressThreshold}
                  onValueChange={handleStressChange}
                  minimumTrackTintColor={stressColor}
                  maximumTrackTintColor={COLORS.surfaceElevated}
                  thumbTintColor={stressColor}
                  step={1}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>0</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>100</Text>
                </View>
              </View>

              <Divider />

              {/* Heart Rate Threshold */}
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Heart size={16} color={hrColor} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "SpaceGrotesk-SemiBold" }}>
                      Heart Rate Alert
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: `${hrColor}18`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: hrColor,
                        fontFamily: "SpaceGrotesk-Bold",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      Alert at {hrThreshold} BPM
                    </Text>
                  </View>
                </View>
                <Slider
                  minimumValue={40}
                  maximumValue={220}
                  value={hrThreshold}
                  onValueChange={handleHrChange}
                  minimumTrackTintColor={hrColor}
                  maximumTrackTintColor={COLORS.surfaceElevated}
                  thumbTintColor={hrColor}
                  step={1}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>40</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>220</Text>
                </View>
              </View>
            </View>

            {/* Save indicator */}
            {(saving || saveSuccess) && (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "SpaceGrotesk-Regular" }}>
                      Saving...
                    </Text>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} color={COLORS.success} />
                    <Text style={{ fontSize: 12, color: COLORS.success, fontFamily: "SpaceGrotesk-Regular" }}>
                      Saved
                    </Text>
                  </>
                )}
              </View>
            )}
          </SectionCard>

          {/* Local Notification Alert Thresholds */}
          <SectionTitle title="SEUILS D'ALERTE" />
          <SectionCard>
            <View style={{ padding: 16 }}>

              {/* Stress max */}
              <AlertSliderRow
                icon={<Activity size={16} color={COLORS.danger} />}
                label="Alerte stress à"
                value={localThresholds.stressMax}
                unit="/100"
                min={40}
                max={90}
                step={1}
                accentColor={COLORS.danger}
                onValueChange={(v) => {
                  console.log("[Settings] Alert stress slider changed:", v);
                  handleAlertThresholdChange("stressMax", v);
                }}
              />

              <Divider />

              {/* Heart rate max */}
              <AlertSliderRow
                icon={<Heart size={16} color={COLORS.warning} />}
                label="Alerte FC à"
                value={localThresholds.heartRateMax}
                unit=" bpm"
                min={80}
                max={130}
                step={1}
                accentColor={COLORS.warning}
                onValueChange={(v) => {
                  console.log("[Settings] Alert heart rate slider changed:", v);
                  handleAlertThresholdChange("heartRateMax", v);
                }}
              />

              <Divider />

              {/* HRV min */}
              <AlertSliderRow
                icon={<Zap size={16} color={COLORS.primary} />}
                label="Alerte HRV sous"
                value={localThresholds.hrvMin}
                unit=" ms"
                min={10}
                max={50}
                step={1}
                accentColor={COLORS.primary}
                onValueChange={(v) => {
                  console.log("[Settings] Alert HRV slider changed:", v);
                  handleAlertThresholdChange("hrvMin", v);
                }}
              />

              <Divider />

              {/* Sleep hours min */}
              <AlertSliderRow
                icon={<Moon size={16} color={COLORS.textSecondary} />}
                label="Alerte sommeil sous"
                value={localThresholds.sleepHoursMin}
                unit="h"
                min={4}
                max={7}
                step={0.5}
                accentColor={COLORS.textSecondary}
                onValueChange={(v) => {
                  console.log("[Settings] Alert sleep hours slider changed:", v);
                  handleAlertThresholdChange("sleepHoursMin", v);
                }}
              />

            </View>

            {alertSaveSuccess && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CheckCircle size={14} color={COLORS.success} />
                <Text style={{ fontSize: 12, color: COLORS.success, fontFamily: "SpaceGrotesk-Regular" }}>
                  Seuils enregistrés
                </Text>
              </View>
            )}
          </SectionCard>

          {/* Subscription Section */}
          <SectionTitle title="SUBSCRIPTION" />
          <SectionCard>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                {subConfig.icon}
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: subConfig.color,
                    fontFamily: "SpaceGrotesk-SemiBold",
                    flex: 1,
                  }}
                >
                  {subConfig.label}
                </Text>
              </View>

              {(subStatus === "expired" || subStatus === "trial") && (
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Settings] Upgrade to Pro pressed");
                    router.push("/paywall");
                  }}
                  style={{
                    backgroundColor: COLORS.primary,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "SpaceGrotesk-Bold" }}>
                    {subStatus === "expired" ? "Upgrade to Pro" : "View Pro Plans"}
                  </Text>
                </AnimatedPressable>
              )}

              {subStatus === "active" && (
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Settings] Manage subscription pressed");
                    router.push("/paywall");
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "SpaceGrotesk-Regular" }}>
                    Manage Subscription
                  </Text>
                  <ChevronRight size={16} color={COLORS.textTertiary} />
                </AnimatedPressable>
              )}
            </View>
          </SectionCard>

          {/* Health Data Section */}
          <SectionTitle title="HEALTH DATA" />
          <SectionCard>
            <View style={{ padding: 16 }}>
              <AnimatedPressable
                onPress={handleSyncHealth}
                disabled={syncing}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <RefreshCw size={18} color={COLORS.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "SpaceGrotesk-SemiBold" }}>
                    Sync Health Data
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.textTertiary, marginTop: 2, fontFamily: "SpaceGrotesk-Regular" }}>
                    {lastSynced ? `Last synced ${formatRelativeDate(lastSynced)}` : "Tap to sync from HealthKit"}
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </AnimatedPressable>
            </View>
          </SectionCard>

          {/* Notifications */}
          <SectionTitle title="NOTIFICATIONS" />
          <SectionCard>
            <AnimatedPressable
              onPress={() => {
                console.log("[Settings] Notification preferences pressed");
                router.push("/notification-preferences");
              }}
              style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={18} color={COLORS.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "SpaceGrotesk-SemiBold" }}>
                Notification Preferences
              </Text>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
          </SectionCard>

          {/* Account Section */}
          <SectionTitle title="ACCOUNT" />
          <SectionCard>
            <AnimatedPressable
              onPress={handleSignOut}
              style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: `${COLORS.danger}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LogOut size={18} color={COLORS.danger} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.danger, fontFamily: "SpaceGrotesk-SemiBold" }}>
                Sign Out
              </Text>
            </AnimatedPressable>
          </SectionCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
