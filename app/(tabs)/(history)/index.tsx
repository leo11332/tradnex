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
import { TrendingUp, Moon, Activity, AlertTriangle, BarChart2 } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { apiGet } from "@/utils/api";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useWindowDimensions } from "react-native";

interface HealthEntry {
  id: string;
  user_id: string;
  recorded_at: string;
  stress_score: number | null;
  heart_rate: number | null;
  hrv: number | null;
  sleep_score: number | null;
  sleep_duration_minutes: number | null;
  sleep_date: string | null;
  source: string;
  created_at: string;
}

type Period = "7" | "30";

function getStressColor(value: number): string {
  if (value < 40) return COLORS.success;
  if (value <= 70) return COLORS.warning;
  return COLORS.danger;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function aggregateByDay(entries: HealthEntry[]): Map<string, HealthEntry[]> {
  const map = new Map<string, HealthEntry[]>();
  for (const e of entries) {
    const day = e.recorded_at.split("T")[0];
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

function avg(vals: (number | null)[]): number {
  const valid = vals.filter((v): v is number => v !== null);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
      {icon}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: COLORS.text,
          fontFamily: "SpaceGrotesk-Bold",
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
        marginBottom: 24,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 32 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <BarChart2 size={24} color={COLORS.primary} />
      </View>
      <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontFamily: "SpaceGrotesk-Regular" }}>
        No {label} data yet
      </Text>
    </View>
  );
}

const CHART_CONFIG = {
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: COLORS.surface,
  color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
  labelColor: () => COLORS.textTertiary,
  strokeWidth: 2,
  decimalPlaces: 0,
  propsForDots: {
    r: "3",
    strokeWidth: "1",
    stroke: COLORS.primary,
  },
  propsForBackgroundLines: {
    stroke: COLORS.divider,
    strokeDasharray: "",
  },
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chartWidth = width - 40 - 32; // screen padding + card padding

  const [period, setPeriod] = useState<Period>("7");
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadEntries = useCallback(
    async (p: Period) => {
      console.log(`[History] Loading entries for ${p} days`);
      try {
        const data = await apiGet<HealthEntry[]>(`/api/health/entries?days=${p}`);
        setEntries(data ?? []);
        setError(null);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      } catch (err) {
        console.error("[History] Failed to load entries:", err);
        setError("Couldn't load your history. Check your connection.");
      } finally {
        setLoading(false);
      }
    },
    [fadeAnim]
  );

  useEffect(() => {
    setLoading(true);
    fadeAnim.setValue(0);
    loadEntries(period);
  }, [period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log("[History] Manual refresh");
    await loadEntries(period);
    setRefreshing(false);
  }, [period, loadEntries]);

  // Aggregate data by day
  const byDay = aggregateByDay(entries);
  const sortedDays = Array.from(byDay.keys()).sort();
  const numDays = parseInt(period);

  // Fill missing days
  const allDays: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    allDays.push(d.toISOString().split("T")[0]);
  }

  const stressData = allDays.map((day) => {
    const dayEntries = byDay.get(day) ?? [];
    return avg(dayEntries.map((e) => e.stress_score));
  });

  const sleepScoreData = allDays.map((day) => {
    const dayEntries = byDay.get(day) ?? [];
    return avg(dayEntries.map((e) => e.sleep_score));
  });

  const hrvData = allDays.map((day) => {
    const dayEntries = byDay.get(day) ?? [];
    return avg(dayEntries.map((e) => e.hrv));
  });

  // Labels — show every Nth label to avoid crowding
  const labelStep = numDays <= 7 ? 1 : Math.ceil(numDays / 7);
  const labels = allDays.map((day, i) => (i % labelStep === 0 ? formatShortDate(day) : ""));

  const hasStress = stressData.some((v) => v > 0);
  const hasSleep = sleepScoreData.some((v) => v > 0);
  const hasHrv = hrvData.some((v) => v > 0);

  // 7-day moving average for HRV
  const hrvMovingAvg = hrvData.map((_, i) => {
    const window = hrvData.slice(Math.max(0, i - 6), i + 1).filter((v) => v > 0);
    if (!window.length) return 0;
    return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
  });

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
          Couldn't load history
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: "center", fontFamily: "SpaceGrotesk-Regular" }}>
          {error}
        </Text>
        <AnimatedPressable
          onPress={() => { setError(null); setLoading(true); loadEntries(period); }}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: -0.5,
            }}
          >
            Performance History
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontFamily: "SpaceGrotesk-Regular" }}>
            Track your health trends over time
          </Text>
        </View>

        {/* Period Selector */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          {(["7", "30"] as Period[]).map((p) => {
            const isActive = period === p;
            return (
              <AnimatedPressable
                key={p}
                onPress={() => {
                  console.log(`[History] Period changed to ${p} days`);
                  setPeriod(p);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: isActive ? COLORS.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: isActive ? "#fff" : COLORS.textSecondary,
                    fontFamily: "SpaceGrotesk-SemiBold",
                  }}
                >
                  {p} Days
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Stress Chart */}
          <SectionHeader
            icon={<TrendingUp size={18} color={COLORS.warning} />}
            title="Stress Level"
          />
          <ChartCard>
            {loading ? (
              <View style={{ gap: 8 }}>
                <SkeletonLine width="100%" height={120} borderRadius={8} />
              </View>
            ) : !hasStress ? (
              <EmptyChart label="stress" />
            ) : (
              <LineChart
                data={{
                  labels,
                  datasets: [
                    {
                      data: stressData.map((v) => Math.max(v, 0.1)),
                      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
                      strokeWidth: 2,
                    },
                  ],
                }}
                width={chartWidth}
                height={160}
                chartConfig={{
                  ...CHART_CONFIG,
                  color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
                  propsForDots: { r: "3", strokeWidth: "1", stroke: COLORS.warning },
                }}
                bezier
                withInnerLines={false}
                withOuterLines={false}
                withShadow={false}
                style={{ marginLeft: -16 }}
                yAxisSuffix=""
                fromZero
                segments={4}
              />
            )}
          </ChartCard>

          {/* Sleep Chart */}
          <SectionHeader
            icon={<Moon size={18} color={COLORS.accent} />}
            title="Sleep Quality"
          />
          <ChartCard>
            {loading ? (
              <SkeletonLine width="100%" height={120} borderRadius={8} />
            ) : !hasSleep ? (
              <EmptyChart label="sleep" />
            ) : (
              <BarChart
                data={{
                  labels,
                  datasets: [
                    {
                      data: sleepScoreData.map((v) => Math.max(v, 0)),
                    },
                  ],
                }}
                width={chartWidth}
                height={160}
                chartConfig={{
                  ...CHART_CONFIG,
                  color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`,
                  fillShadowGradient: COLORS.accent,
                  fillShadowGradientOpacity: 0.8,
                }}
                style={{ marginLeft: -16 }}
                fromZero
                showValuesOnTopOfBars={false}
                withInnerLines={false}
                yAxisSuffix=""
                yAxisLabel=""
                segments={4}
              />
            )}
          </ChartCard>

          {/* HRV Chart */}
          <SectionHeader
            icon={<Activity size={18} color={COLORS.success} />}
            title="HRV Trend"
          />
          <ChartCard>
            {loading ? (
              <SkeletonLine width="100%" height={120} borderRadius={8} />
            ) : !hasHrv ? (
              <EmptyChart label="HRV" />
            ) : (
              <LineChart
                data={{
                  labels,
                  datasets: [
                    {
                      data: hrvData.map((v) => Math.max(v, 0.1)),
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity * 0.4})`,
                      strokeWidth: 1,
                    },
                    {
                      data: hrvMovingAvg.map((v) => Math.max(v, 0.1)),
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["HRV", "7-day avg"],
                }}
                width={chartWidth}
                height={160}
                chartConfig={{
                  ...CHART_CONFIG,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  propsForDots: { r: "3", strokeWidth: "1", stroke: COLORS.success },
                }}
                bezier
                withInnerLines={false}
                withOuterLines={false}
                withShadow={false}
                style={{ marginLeft: -16 }}
                yAxisSuffix=" ms"
                fromZero
                segments={4}
              />
            )}
          </ChartCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
