import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CalendarDays, BarChart3, Calendar, AlertTriangle, ClipboardList } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { apiGet } from "@/utils/api";
import { generateMockHistory } from "@/utils/health";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { DayCard, DayData } from "@/components/health/DayCard";
import { WeeklyReport } from "@/components/health/WeeklyReport";
import { MonthlyReport } from "@/components/health/MonthlyReport";

type ViewMode = "jour" | "semaine" | "mois";

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

const PERIODS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: "jour", label: "Jour", icon: <CalendarDays size={14} color="inherit" /> },
  { key: "semaine", label: "Semaine", icon: <BarChart3 size={14} color="inherit" /> },
  { key: "mois", label: "Mois", icon: <Calendar size={14} color="inherit" /> },
];

function SkeletonDayCard({ index }: { index: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <View style={{ height: 3, backgroundColor: COLORS.surfaceElevated }} />
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SkeletonLine width={100} height={14} borderRadius={7} />
          <SkeletonLine width={72} height={22} borderRadius={11} />
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <SkeletonLine width={80} height={28} borderRadius={8} />
          <SkeletonLine width={88} height={28} borderRadius={8} />
          <SkeletonLine width={96} height={28} borderRadius={8} />
          <SkeletonLine width={84} height={28} borderRadius={8} />
        </View>
      </View>
    </Animated.View>
  );
}

function PeriodSelector({
  active,
  onChange,
}: {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const containerWidth = width - 40; // screen padding
  const pillWidth = (containerWidth - 8) / 3; // 3 options, 4px padding each side

  const indexMap: Record<ViewMode, number> = { jour: 0, semaine: 1, mois: 2 };

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: indexMap[active] * pillWidth,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [active, pillWidth]);

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 14,
        padding: 4,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
        position: "relative",
      }}
    >
      {/* Animated pill indicator */}
      <Animated.View
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: pillWidth,
          height: "100%",
          backgroundColor: COLORS.primary,
          borderRadius: 10,
          transform: [{ translateX: indicatorAnim }],
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        }}
      />

      {PERIODS.map((p) => {
        const isActive = active === p.key;
        const iconColor = isActive ? "#fff" : COLORS.textSecondary;
        return (
          <AnimatedPressable
            key={p.key}
            onPress={() => {
              console.log(`[History] Period selector changed to: ${p.key}`);
              onChange(p.key);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingVertical: 10,
              borderRadius: 10,
              zIndex: 1,
            }}
          >
            <CalendarDays
              size={13}
              color={iconColor}
              style={{ display: p.key === "jour" ? "flex" : "none" }}
            />
            <BarChart3
              size={13}
              color={iconColor}
              style={{ display: p.key === "semaine" ? "flex" : "none" }}
            />
            <Calendar
              size={13}
              color={iconColor}
              style={{ display: p.key === "mois" ? "flex" : "none" }}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: isActive ? "#fff" : COLORS.textSecondary,
                fontFamily: "SpaceGrotesk-SemiBold",
              }}
            >
              {p.label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function EmptyDayState() {
  return (
    <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <ClipboardList size={32} color={COLORS.primary} />
      </View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "700",
          color: COLORS.text,
          fontFamily: "SpaceGrotesk-Bold",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Aucun historique
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: COLORS.textSecondary,
          fontFamily: "SpaceGrotesk-Regular",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        Vos données de santé quotidiennes apparaîtront ici une fois synchronisées.
      </Text>
    </View>
  );
}

function convertEntriesToDayData(entries: HealthEntry[]): DayData[] {
  const byDay = new Map<string, HealthEntry[]>();
  for (const e of entries) {
    const day = e.recorded_at.split("T")[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  const result: DayData[] = [];
  byDay.forEach((dayEntries, date) => {
    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return 0;
      return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    };
    const avgFloat = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      if (!valid.length) return 7;
      return valid.reduce((a, b) => a + b, 0) / valid.length;
    };

    result.push({
      date,
      heartRate: avg(dayEntries.map((e) => e.heart_rate)) || 72,
      hrv: avg(dayEntries.map((e) => e.hrv)) || 50,
      sleepHours: Number((avgFloat(dayEntries.map((e) => e.sleep_duration_minutes)) / 60).toFixed(1)),
      sleepQuality: avg(dayEntries.map((e) => e.sleep_score)) || 70,
      stressScore: avg(dayEntries.map((e) => e.stress_score)) || 50,
    });
  });

  return result.sort((a, b) => b.date.localeCompare(a.date));
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("jour");
  const [allData, setAllData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const headerFade = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    console.log("[History] Loading health history data");
    try {
      const data = await apiGet<HealthEntry[]>("/api/health/entries?days=90");
      const converted = convertEntriesToDayData(data ?? []);
      setAllData(converted);
      setError(null);
      console.log(`[History] Loaded ${converted.length} days from API`);
    } catch (err) {
      console.warn("[History] API unavailable, using mock data:", err);
      const mock = generateMockHistory(30);
      const mockData: DayData[] = mock.map((m) => ({
        date: m.date,
        heartRate: m.heartRate,
        hrv: m.hrv,
        sleepHours: m.sleepHours,
        sleepQuality: m.sleepQuality,
        stressScore: m.stressScore,
      }));
      setAllData(mockData.sort((a, b) => b.date.localeCompare(a.date)));
      setError(null);
      console.log(`[History] Mock data loaded: ${mockData.length} days`);
    } finally {
      setLoading(false);
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    console.log("[History] Manual refresh triggered");
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundColor: "rgba(239,68,68,0.12)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={28} color={COLORS.danger} />
        </View>
        <Text
          style={{
            color: COLORS.text,
            fontSize: 18,
            fontWeight: "700",
            fontFamily: "SpaceGrotesk-Bold",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Impossible de charger l'historique
        </Text>
        <Text
          style={{
            color: COLORS.textSecondary,
            fontSize: 14,
            textAlign: "center",
            fontFamily: "SpaceGrotesk-Regular",
            lineHeight: 20,
            marginBottom: 24,
          }}
        >
          {error}
        </Text>
        <AnimatedPressable
          onPress={() => {
            console.log("[History] Retry button pressed");
            setError(null);
            setLoading(true);
            loadData();
          }}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingHorizontal: 28,
            paddingVertical: 13,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "600",
              fontFamily: "SpaceGrotesk-SemiBold",
              fontSize: 15,
            }}
          >
            Réessayer
          </Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
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
        {/* Header */}
        <Animated.View style={{ opacity: headerFade, marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: -0.5,
            }}
          >
            Historique
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textSecondary,
              marginTop: 4,
              fontFamily: "SpaceGrotesk-Regular",
            }}
          >
            Suivez vos tendances de santé
          </Text>
        </Animated.View>

        {/* Period selector */}
        <PeriodSelector active={viewMode} onChange={setViewMode} />

        {/* Content */}
        {viewMode === "jour" && (
          <>
            {loading ? (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonDayCard key={i} index={i} />
                ))}
              </>
            ) : allData.length === 0 ? (
              <EmptyDayState />
            ) : (
              allData.map((day, index) => (
                <DayCard
                  key={day.date}
                  day={day}
                  index={index}
                  onPress={(d) => {
                    console.log(`[History] Day card pressed, navigating to day-detail: ${d.date}`);
                    router.push(`/day-detail?date=${d.date}`);
                  }}
                />
              ))
            )}
          </>
        )}

        {viewMode === "semaine" && (
          <WeeklyReport
            allData={allData}
            weekOffset={weekOffset}
            onWeekChange={(offset) => {
              console.log(`[History] Weekly view offset changed: ${offset}`);
              setWeekOffset(offset);
            }}
          />
        )}

        {viewMode === "mois" && (
          <MonthlyReport
            allData={allData}
            monthOffset={monthOffset}
            onMonthChange={(offset) => {
              console.log(`[History] Monthly view offset changed: ${offset}`);
              setMonthOffset(offset);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}
