import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Heart, Activity, Moon, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";

export interface DayData {
  date: string;
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepQuality: number;
  stressScore: number;
}

function getHealthScore(day: DayData): number {
  const stressComponent = 100 - day.stressScore;
  const sleepComponent = day.sleepQuality;
  const hrvComponent = Math.min(100, (day.hrv / 65) * 100);
  return Math.round((stressComponent + sleepComponent + hrvComponent) / 3);
}

function getScoreColor(score: number): string {
  if (score >= 70) return COLORS.success;
  if (score >= 45) return COLORS.warning;
  return COLORS.danger;
}

function getScoreLabel(score: number): string {
  if (score >= 70) return "Bon";
  if (score >= 45) return "Moyen";
  return "Faible";
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Aujourd'hui";
  if (dateStr === yesterdayStr) return "Hier";

  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function MetricPill({
  icon,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: COLORS.divider,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: color,
          fontFamily: "SpaceGrotesk-Bold",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: COLORS.textTertiary,
          fontFamily: "SpaceGrotesk-Regular",
        }}
      >
        {unit}
      </Text>
    </View>
  );
}

interface DayCardProps {
  day: DayData;
  index: number;
  onPress?: (day: DayData) => void;
}

export function DayCard({ day, index, onPress }: DayCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const score = getHealthScore(day);
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);
  const dateLabel = formatDateLabel(day.date);
  const sleepHoursDisplay = Number(day.sleepHours).toFixed(1);
  const stressDisplay = String(day.stressScore);
  const heartRateDisplay = String(day.heartRate);
  const hrvDisplay = String(day.hrv);

  const TrendIcon =
    score >= 70 ? TrendingUp : score >= 45 ? Minus : TrendingDown;
  const trendColor =
    score >= 70 ? COLORS.success : score >= 45 ? COLORS.warning : COLORS.danger;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={() => {
          console.log(`[History] DayCard pressed: ${day.date}, score: ${score}`);
          onPress?.(day);
        }}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          marginBottom: 12,
          overflow: "hidden",
        }}
      >
        {/* Score accent bar */}
        <View
          style={{
            height: 3,
            backgroundColor: scoreColor,
            opacity: 0.7,
          }}
        />

        <View style={{ padding: 16 }}>
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: COLORS.text,
                fontFamily: "SpaceGrotesk-Bold",
                letterSpacing: -0.2,
              }}
            >
              {dateLabel}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: `${scoreColor}18`,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: `${scoreColor}30`,
              }}
            >
              <TrendIcon size={12} color={scoreColor} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: scoreColor,
                  fontFamily: "SpaceGrotesk-Bold",
                }}
              >
                {score}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: scoreColor,
                  fontFamily: "SpaceGrotesk-Regular",
                  opacity: 0.8,
                }}
              >
                {scoreLabel}
              </Text>
            </View>
          </View>

          {/* Metrics grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <MetricPill
              icon={<Heart size={11} color={COLORS.danger} />}
              value={heartRateDisplay}
              unit="bpm"
              color={COLORS.text}
            />
            <MetricPill
              icon={<Activity size={11} color={COLORS.success} />}
              value={hrvDisplay}
              unit="ms HRV"
              color={COLORS.text}
            />
            <MetricPill
              icon={<Moon size={11} color={COLORS.accent} />}
              value={sleepHoursDisplay}
              unit="h sommeil"
              color={COLORS.text}
            />
            <MetricPill
              icon={<Zap size={11} color={COLORS.warning} />}
              value={stressDisplay}
              unit="% stress"
              color={
                day.stressScore < 40
                  ? COLORS.success
                  : day.stressScore <= 70
                  ? COLORS.warning
                  : COLORS.danger
              }
            />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export { getHealthScore, getScoreColor, formatDateLabel };
