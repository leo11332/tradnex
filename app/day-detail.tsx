import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  useWindowDimensions,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronRight,
  TrendingUp,
  Moon,
  Heart,
  Activity,
  Clock,
} from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntradayPoint {
  hour: number; // 0–23.5 (0.5 = 30min)
  stress: number;
  bpm: number;
}

interface TooltipData {
  x: number;
  y: number;
  stress: number;
  bpm: number;
  timeLabel: string;
}

// ─── Mock data generator ──────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function generateIntradayData(dateStr: string): IntradayPoint[] {
  // Seed based on date for stable data
  const seed = dateStr.split("-").reduce((a, b) => a + Number(b), 0);
  const rng = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233) * 0.5 + 0.5;
    return x;
  };

  const points: IntradayPoint[] = [];

  for (let i = 0; i < 48; i++) {
    const hour = i * 0.5; // 0, 0.5, 1, 1.5 ... 23.5
    const h = Math.floor(hour);
    const noise = (rng(i) - 0.5) * 14;

    // Base stress profile for a trader
    let baseStress = 30;

    // Sleep period 23:00–07:00 → very low stress
    if (h >= 23 || h < 7) {
      baseStress = 18 + rng(i + 100) * 10;
    }
    // Asian open 01:00–03:00 → moderate spike
    else if (h >= 1 && h < 3) {
      baseStress = 52 + rng(i + 200) * 18;
    }
    // Morning calm 07:00–09:00
    else if (h >= 7 && h < 9) {
      baseStress = 28 + rng(i + 300) * 12;
    }
    // European open 09:00–10:30 → spike
    else if (h >= 9 && h < 10.5) {
      baseStress = 58 + rng(i + 400) * 20;
    }
    // European session 10:30–15:00 → moderate
    else if (h >= 10.5 && h < 15) {
      baseStress = 42 + rng(i + 500) * 16;
    }
    // NY open overlap 15:30–17:30 → highest stress
    else if (h >= 15.5 && h < 17.5) {
      baseStress = 72 + rng(i + 600) * 22;
    }
    // NY session 17:30–22:00 → elevated
    else if (h >= 17.5 && h < 22) {
      baseStress = 50 + rng(i + 700) * 18;
    }
    // Evening wind-down 22:00–23:00
    else if (h >= 22 && h < 23) {
      baseStress = 32 + rng(i + 800) * 10;
    }

    const stress = clamp(Math.round(baseStress + noise), 5, 98);

    // BPM correlates loosely with stress
    const baseBpm = 58 + stress * 0.38 + (rng(i + 900) - 0.5) * 12;
    const bpm = clamp(Math.round(baseBpm), 48, 115);

    points.push({ hour, stress, bpm });
  }

  return points;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = h % 1 === 0.5 ? "30" : "00";
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function getStressColor(stress: number): string {
  if (stress < 40) return COLORS.success;
  if (stress <= 70) return COLORS.warning;
  return COLORS.danger;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function computeScore(stressAvg: number, bpmAvg: number, sleepH: number): number {
  const stressComp = 100 - stressAvg;
  const bpmComp = clamp(100 - Math.abs(bpmAvg - 65) * 0.8, 0, 100);
  const sleepComp = clamp((sleepH / 8) * 100, 0, 100);
  return Math.round((stressComp * 0.5 + bpmComp * 0.25 + sleepComp * 0.25));
}

// ─── Session bands config ─────────────────────────────────────────────────────

const SESSIONS = [
  {
    key: "asie",
    label: "Asie",
    startH: 1,
    endH: 9,
    color: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.25)",
    textColor: "#3B82F6",
    emoji: "🌏",
    fullLabel: "01:00–09:00",
  },
  {
    key: "europe",
    label: "Europe",
    startH: 9,
    endH: 17.5,
    color: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.22)",
    textColor: "#22C55E",
    emoji: "🌍",
    fullLabel: "09:00–17:30",
  },
  {
    key: "us",
    label: "US",
    startH: 15.5,
    endH: 22,
    color: "rgba(249,115,22,0.13)",
    borderColor: "rgba(249,115,22,0.25)",
    textColor: "#F97316",
    emoji: "🗽",
    fullLabel: "15:30–22:00",
  },
  {
    key: "overlap",
    label: "Overlap",
    startH: 15.5,
    endH: 17.5,
    color: "rgba(249,115,22,0.10)",
    borderColor: "rgba(249,115,22,0.0)",
    textColor: "#FB923C",
    emoji: "⚡",
    fullLabel: "15:30–17:30",
  },
];

// ─── Chart component ──────────────────────────────────────────────────────────

interface StressChartProps {
  data: IntradayPoint[];
  chartWidth: number;
  chartHeight: number;
  onPointPress: (tooltip: TooltipData) => void;
}

function StressChart({ data, chartWidth, chartHeight, onPointPress }: StressChartProps) {
  const TOTAL_HOURS = 24;
  const PADDING_LEFT = 32;
  const PADDING_RIGHT = 8;
  const PADDING_TOP = 20;
  const PADDING_BOTTOM = 24;

  const plotW = chartWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotH = chartHeight - PADDING_TOP - PADDING_BOTTOM;

  const toX = (hour: number) => PADDING_LEFT + (hour / TOTAL_HOURS) * plotW;
  const toY = (stress: number) => PADDING_TOP + plotH - (stress / 100) * plotH;

  // Build line segments
  const segments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];
    const x1 = toX(p1.hour);
    const y1 = toY(p1.stress);
    const x2 = toX(p2.hour);
    const y2 = toY(p2.stress);
    const midStress = (p1.stress + p2.stress) / 2;
    segments.push({ x1, y1, x2, y2, color: getStressColor(midStress) });
  }

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // X-axis labels (every 4h)
  const xLabels = [0, 4, 8, 12, 16, 20, 24];

  return (
    <View style={{ width: chartWidth, height: chartHeight }}>
      {/* Session bands */}
      {SESSIONS.filter((s) => s.key !== "overlap").map((session) => {
        const bx = toX(session.startH);
        const bw = toX(session.endH) - toX(session.startH);
        return (
          <View
            key={session.key}
            style={{
              position: "absolute",
              left: bx,
              top: PADDING_TOP,
              width: bw,
              height: plotH,
              backgroundColor: session.color,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: session.borderColor,
            }}
          >
            <Text
              style={{
                position: "absolute",
                top: 3,
                left: 3,
                fontSize: 9,
                color: session.textColor,
                fontFamily: "SpaceGrotesk-SemiBold",
                fontWeight: "600",
              }}
            >
              {session.label}
            </Text>
          </View>
        );
      })}

      {/* Overlap band (stronger tint on top) */}
      {(() => {
        const ov = SESSIONS.find((s) => s.key === "overlap")!;
        const bx = toX(ov.startH);
        const bw = toX(ov.endH) - toX(ov.startH);
        return (
          <View
            key="overlap"
            style={{
              position: "absolute",
              left: bx,
              top: PADDING_TOP,
              width: bw,
              height: plotH,
              backgroundColor: "rgba(249,115,22,0.08)",
            }}
          />
        );
      })()}

      {/* Sleep band */}
      {(() => {
        // Sleep: 23:00–07:00 (wraps midnight)
        const sleepColor = "rgba(139,92,246,0.08)";
        const sleepBorder = "rgba(139,92,246,0.2)";
        // 00:00–07:00
        const w1 = toX(7) - toX(0);
        // 23:00–24:00
        const x2 = toX(23);
        const w2 = toX(24) - x2;
        return (
          <>
            <View
              style={{
                position: "absolute",
                left: PADDING_LEFT,
                top: PADDING_TOP,
                width: w1,
                height: plotH,
                backgroundColor: sleepColor,
                borderRightWidth: 1,
                borderColor: sleepBorder,
              }}
            />
            <View
              style={{
                position: "absolute",
                left: x2,
                top: PADDING_TOP,
                width: w2,
                height: plotH,
                backgroundColor: sleepColor,
                borderLeftWidth: 1,
                borderColor: sleepBorder,
              }}
            />
          </>
        );
      })()}

      {/* Y-axis grid lines */}
      {yLabels.map((v) => {
        const y = toY(v);
        return (
          <View key={v} style={{ position: "absolute", left: 0, top: y, right: 0, flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                width: PADDING_LEFT - 4,
                fontSize: 9,
                color: COLORS.textTertiary,
                textAlign: "right",
                fontFamily: "SpaceGrotesk-Regular",
              }}
            >
              {v}
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: COLORS.divider,
                opacity: v === 0 ? 0 : 0.5,
              }}
            />
          </View>
        );
      })}

      {/* Line segments */}
      {segments.map((seg, i) => {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const cx = (seg.x1 + seg.x2) / 2;
        const cy = (seg.y1 + seg.y2) / 2;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx - length / 2,
              top: cy - 1,
              width: length,
              height: 2,
              backgroundColor: seg.color,
              borderRadius: 1,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* Data point dots (every 4th = every 2h) */}
      {data
        .filter((_, i) => i % 4 === 0)
        .map((pt) => {
          const x = toX(pt.hour);
          const y = toY(pt.stress);
          const color = getStressColor(pt.stress);
          return (
            <TouchableOpacity
              key={pt.hour}
              onPress={() => {
                console.log(`[DayDetail] Stress point tapped: ${formatHour(pt.hour)} stress=${pt.stress} bpm=${pt.bpm}`);
                onPointPress({
                  x,
                  y,
                  stress: pt.stress,
                  bpm: pt.bpm,
                  timeLabel: formatHour(pt.hour),
                });
              }}
              style={{
                position: "absolute",
                left: x - 5,
                top: y - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: COLORS.background,
              }}
            />
          );
        })}

      {/* X-axis labels */}
      {xLabels.map((h) => {
        const x = toX(h === 24 ? 23.9 : h);
        return (
          <Text
            key={h}
            style={{
              position: "absolute",
              left: x - 12,
              top: PADDING_TOP + plotH + 6,
              fontSize: 9,
              color: COLORS.textTertiary,
              fontFamily: "SpaceGrotesk-Regular",
              width: 24,
              textAlign: "center",
            }}
          >
            {h === 24 ? "24h" : `${String(h).padStart(2, "0")}h`}
          </Text>
        );
      })}
    </View>
  );
}

// ─── BPM Bar Chart ────────────────────────────────────────────────────────────

interface BpmChartProps {
  data: IntradayPoint[];
  chartWidth: number;
  chartHeight: number;
}

function BpmChart({ data, chartWidth, chartHeight }: BpmChartProps) {
  const PADDING_LEFT = 32;
  const PADDING_RIGHT = 8;
  const PADDING_TOP = 8;
  const PADDING_BOTTOM = 4;

  const plotW = chartWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotH = chartHeight - PADDING_TOP - PADDING_BOTTOM;

  const bpmMin = 40;
  const bpmMax = 130;

  const barW = Math.max(2, plotW / data.length - 1);

  return (
    <View style={{ width: chartWidth, height: chartHeight }}>
      {/* Y label */}
      <Text
        style={{
          position: "absolute",
          left: 0,
          top: PADDING_TOP,
          fontSize: 9,
          color: COLORS.textTertiary,
          fontFamily: "SpaceGrotesk-Regular",
          width: PADDING_LEFT - 4,
          textAlign: "right",
        }}
      >
        BPM
      </Text>

      {data.map((pt, i) => {
        const x = PADDING_LEFT + (i / data.length) * plotW;
        const ratio = clamp((pt.bpm - bpmMin) / (bpmMax - bpmMin), 0, 1);
        const barH = Math.max(2, ratio * plotH);
        const y = PADDING_TOP + plotH - barH;

        const intensity = ratio;
        const r = Math.round(14 + intensity * 100);
        const g = Math.round(165 + intensity * 30);
        const b = Math.round(233);
        const barColor = `rgba(${r},${g},${b},0.75)`;

        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: barW,
              height: barH,
              backgroundColor: barColor,
              borderRadius: 1,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        minWidth: 80,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
        {icon}
        <Text
          style={{
            fontSize: 10,
            color: COLORS.textTertiary,
            fontFamily: "SpaceGrotesk-Regular",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: color,
          fontFamily: "SpaceGrotesk-Bold",
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
          color: COLORS.textTertiary,
          fontFamily: "SpaceGrotesk-Regular",
          marginTop: 1,
        }}
      >
        {unit}
      </Text>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: COLORS.surfaceElevated,
        opacity,
      }}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IntradayPoint[]>([]);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const chartWidth = screenWidth - 40;
  const stressChartH = 200;
  const bpmChartH = 80;

  const safeDate = date ?? new Date().toISOString().split("T")[0];

  useEffect(() => {
    console.log(`[DayDetail] Loading intraday data for date: ${safeDate}`);
    // Simulate async load
    const timer = setTimeout(() => {
      const generated = generateIntradayData(safeDate);
      setData(generated);
      setLoading(false);
      console.log(`[DayDetail] Loaded ${generated.length} intraday points`);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }, 600);
    return () => clearTimeout(timer);
  }, [safeDate]);

  const handlePointPress = useCallback((t: TooltipData) => {
    setTooltip(t);
  }, []);

  // Computed stats
  const stressValues = data.map((d) => d.stress);
  const bpmValues = data.map((d) => d.bpm);

  const stressAvg = avg(stressValues);
  const stressMax = stressValues.length ? Math.max(...stressValues) : 0;
  const stressMin = stressValues.length ? Math.min(...stressValues) : 0;
  const bpmAvg = avg(bpmValues);
  const bpmMax = bpmValues.length ? Math.max(...bpmValues) : 0;
  const bpmMin = bpmValues.length ? Math.min(...bpmValues) : 0;
  const sleepH = 7.2; // mock sleep hours
  const score = computeScore(stressAvg, bpmAvg, sleepH);

  const scoreColor =
    score >= 70 ? COLORS.success : score >= 45 ? COLORS.warning : COLORS.danger;
  const scoreLabel =
    score >= 70 ? "Excellent" : score >= 45 ? "Moyen" : "Faible";

  const dateLabel = formatDateFull(safeDate);
  const stressAvgStr = String(stressAvg);
  const stressMaxStr = String(stressMax);
  const stressMinStr = String(stressMin);
  const bpmAvgStr = String(bpmAvg);
  const bpmMaxStr = String(bpmMax);
  const bpmMinStr = String(bpmMin);
  const sleepStr = Number(sleepH).toFixed(1);
  const scoreStr = String(score);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
          backgroundColor: COLORS.background,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            console.log("[DayDetail] Back button pressed");
            router.back();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: COLORS.surfaceSecondary,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <ChevronRight
            size={18}
            color={COLORS.text}
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
              letterSpacing: -0.3,
            }}
          >
            {dateLabel}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textSecondary,
              fontFamily: "SpaceGrotesk-Regular",
              marginTop: 1,
            }}
          >
            Analyse intraday
          </Text>
        </View>
        {!loading && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              backgroundColor: `${scoreColor}18`,
              borderWidth: 1,
              borderColor: `${scoreColor}35`,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: scoreColor,
                fontFamily: "SpaceGrotesk-Bold",
              }}
            >
              {scoreStr}
            </Text>
            <Text
              style={{
                fontSize: 9,
                color: scoreColor,
                fontFamily: "SpaceGrotesk-Regular",
                textAlign: "center",
                opacity: 0.8,
              }}
            >
              {scoreLabel}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          // Skeleton state
          <View style={{ gap: 16 }}>
            <SkeletonBlock width="100%" height={220} borderRadius={14} />
            <SkeletonBlock width="100%" height={90} borderRadius={14} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SkeletonBlock width="48%" height={80} borderRadius={14} />
              <SkeletonBlock width="48%" height={80} borderRadius={14} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SkeletonBlock width="48%" height={80} borderRadius={14} />
              <SkeletonBlock width="48%" height={80} borderRadius={14} />
            </View>
          </View>
        ) : (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              gap: 16,
            }}
          >
            {/* Stress Chart Card */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Activity size={15} color={COLORS.warning} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: COLORS.text,
                    fontFamily: "SpaceGrotesk-Bold",
                    letterSpacing: 0.5,
                    flex: 1,
                  }}
                >
                  STRESS INTRADAY
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success }} />
                  <Text style={{ fontSize: 9, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
                    Bas
                  </Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning }} />
                  <Text style={{ fontSize: 9, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
                    Moyen
                  </Text>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger }} />
                  <Text style={{ fontSize: 9, color: COLORS.textTertiary, fontFamily: "SpaceGrotesk-Regular" }}>
                    Élevé
                  </Text>
                </View>
              </View>

              <StressChart
                data={data}
                chartWidth={chartWidth - 32}
                chartHeight={stressChartH}
                onPointPress={handlePointPress}
              />
            </View>

            {/* BPM Chart Card */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Heart size={15} color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: COLORS.text,
                    fontFamily: "SpaceGrotesk-Bold",
                    letterSpacing: 0.5,
                  }}
                >
                  FRÉQUENCE CARDIAQUE
                </Text>
              </View>
              <BpmChart
                data={data}
                chartWidth={chartWidth - 32}
                chartHeight={bpmChartH}
              />
            </View>

            {/* Stats Grid */}
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: COLORS.textTertiary,
                  letterSpacing: 1.5,
                  fontFamily: "SpaceGrotesk-Bold",
                  marginBottom: 10,
                  paddingHorizontal: 2,
                }}
              >
                STATISTIQUES DU JOUR
              </Text>

              {/* Stress row */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <StatCard
                  icon={<Activity size={12} color={COLORS.warning} />}
                  label="Stress moy."
                  value={stressAvgStr}
                  unit="/ 100"
                  color={getStressColor(stressAvg)}
                />
                <StatCard
                  icon={<TrendingUp size={12} color={COLORS.danger} />}
                  label="Stress max"
                  value={stressMaxStr}
                  unit="/ 100"
                  color={COLORS.danger}
                />
                <StatCard
                  icon={<Activity size={12} color={COLORS.success} />}
                  label="Stress min"
                  value={stressMinStr}
                  unit="/ 100"
                  color={COLORS.success}
                />
              </View>

              {/* BPM row */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <StatCard
                  icon={<Heart size={12} color={COLORS.primary} />}
                  label="BPM moy."
                  value={bpmAvgStr}
                  unit="bpm"
                  color={COLORS.primary}
                />
                <StatCard
                  icon={<TrendingUp size={12} color={COLORS.danger} />}
                  label="BPM max"
                  value={bpmMaxStr}
                  unit="bpm"
                  color={COLORS.danger}
                />
                <StatCard
                  icon={<Heart size={12} color={COLORS.success} />}
                  label="BPM min"
                  value={bpmMinStr}
                  unit="bpm"
                  color={COLORS.success}
                />
              </View>

              {/* Sleep + Score row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard
                  icon={<Moon size={12} color={COLORS.accent} />}
                  label="Sommeil"
                  value={sleepStr}
                  unit="heures"
                  color={COLORS.accent}
                />
                <StatCard
                  icon={<Clock size={12} color={scoreColor} />}
                  label="Score global"
                  value={scoreStr}
                  unit={scoreLabel}
                  color={scoreColor}
                />
              </View>
            </View>

            {/* Session Legend */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: COLORS.textTertiary,
                  letterSpacing: 1.5,
                  fontFamily: "SpaceGrotesk-Bold",
                  marginBottom: 12,
                }}
              >
                SESSIONS DE TRADING (PARIS UTC+2)
              </Text>

              {SESSIONS.map((session) => (
                <View
                  key={session.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 8,
                    borderBottomWidth: session.key !== "overlap" ? 1 : 0,
                    borderBottomColor: COLORS.divider,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: session.color,
                      borderWidth: 1,
                      borderColor: session.borderColor,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>{session.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: session.textColor,
                        fontFamily: "SpaceGrotesk-SemiBold",
                      }}
                    >
                      {session.key === "asie"
                        ? "Session Asiatique"
                        : session.key === "europe"
                        ? "Session Européenne"
                        : session.key === "us"
                        ? "Session Américaine (NYSE)"
                        : "Overlap Europe / US"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: COLORS.textTertiary,
                        fontFamily: "SpaceGrotesk-Regular",
                        marginTop: 1,
                      }}
                    >
                      {session.fullLabel}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Sleep legend */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: 8,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: "rgba(139,92,246,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(139,92,246,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Moon size={14} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "#8B5CF6",
                      fontFamily: "SpaceGrotesk-SemiBold",
                    }}
                  >
                    Période de sommeil
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.textTertiary,
                      fontFamily: "SpaceGrotesk-Regular",
                      marginTop: 1,
                    }}
                  >
                    23:00–07:00
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Tooltip Modal */}
      {tooltip && (
        <Modal transparent animationType="fade" onRequestClose={() => setTooltip(null)}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              console.log("[DayDetail] Tooltip dismissed");
              setTooltip(null);
            }}
          >
            <View
              style={{
                position: "absolute",
                top: insets.top + 80,
                left: 20,
                right: 20,
                backgroundColor: COLORS.surfaceElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  fontFamily: "SpaceGrotesk-Regular",
                  marginBottom: 8,
                }}
              >
                {tooltip.timeLabel}
              </Text>
              <View style={{ flexDirection: "row", gap: 20 }}>
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.textTertiary,
                      fontFamily: "SpaceGrotesk-Regular",
                    }}
                  >
                    Stress
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: getStressColor(tooltip.stress),
                      fontFamily: "SpaceGrotesk-Bold",
                    }}
                  >
                    {tooltip.stress}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.textTertiary,
                      fontFamily: "SpaceGrotesk-Regular",
                    }}
                  >
                    BPM
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: COLORS.primary,
                      fontFamily: "SpaceGrotesk-Bold",
                    }}
                  >
                    {tooltip.bpm}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: COLORS.textTertiary,
                  fontFamily: "SpaceGrotesk-Regular",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Appuyer pour fermer
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
