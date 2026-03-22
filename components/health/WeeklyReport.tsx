import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { ChevronLeft, ChevronRight, Star, TrendingUp, TrendingDown, Activity, Moon, Heart, Zap } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { DayData, getHealthScore, getScoreColor } from "./DayCard";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function getWeekDays(weekOffset: number): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function formatWeekRange(weekOffset: number): string {
  const days = getWeekDays(weekOffset);
  const start = new Date(days[0] + "T12:00:00");
  const end = new Date(days[6] + "T12:00:00");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${months[end.getMonth()]}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

interface BarProps {
  value: number;
  maxValue: number;
  color: string;
  label: string;
  isToday: boolean;
  isBest: boolean;
  isWorst: boolean;
  index: number;
}

function DayBar({ value, maxValue, color, label, isToday, isBest, isWorst, index }: BarProps) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const fillRatio = maxValue > 0 ? value / maxValue : 0;
  const BAR_MAX_HEIGHT = 80;
  const barHeight = Math.max(4, Math.round(fillRatio * BAR_MAX_HEIGHT));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: barHeight,
        duration: 500,
        delay: index * 60,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [barHeight]);

  const barColor = isToday ? COLORS.primary : color;

  return (
    <Animated.View
      style={{
        opacity,
        alignItems: "center",
        flex: 1,
        gap: 4,
      }}
    >
      {isBest && (
        <Star size={10} color={COLORS.gold} fill={COLORS.gold} />
      )}
      {!isBest && <View style={{ height: 14 }} />}

      <View
        style={{
          height: BAR_MAX_HEIGHT,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Animated.View
          style={{
            width: 28,
            height: heightAnim,
            borderRadius: 6,
            backgroundColor: barColor,
            opacity: isWorst ? 0.4 : 1,
          }}
        />
      </View>

      <Text
        style={{
          fontSize: 10,
          color: isToday ? COLORS.primary : COLORS.textTertiary,
          fontFamily: isToday ? "SpaceGrotesk-Bold" : "SpaceGrotesk-Regular",
          fontWeight: isToday ? "700" : "400",
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

function StatRow({ icon, label, value, trend }: StatRowProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  const trendColor =
    trend === "up" ? COLORS.success : trend === "down" ? COLORS.danger : COLORS.textTertiary;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: COLORS.surfaceSecondary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          color: COLORS.textSecondary,
          fontFamily: "SpaceGrotesk-Regular",
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {TrendIcon && <TrendIcon size={13} color={trendColor} />}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: COLORS.text,
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

interface WeeklyReportProps {
  allData: DayData[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
}

export function WeeklyReport({ allData, weekOffset, onWeekChange }: WeeklyReportProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const weekDays = getWeekDays(weekOffset);
  const weekLabel = formatWeekRange(weekOffset);
  const isCurrentWeek = weekOffset === 0;

  const weekData = weekDays.map((date) => {
    const found = allData.find((d) => d.date === date);
    return found ?? null;
  });

  const scores = weekData.map((d) => (d ? getHealthScore(d) : 0));
  const maxScore = Math.max(...scores, 1);
  const validScores = scores.filter((s) => s > 0);
  const bestIdx = scores.indexOf(Math.max(...scores));
  const worstIdx = scores.indexOf(Math.min(...validScores.length ? validScores : [0]));

  const today = new Date().toISOString().split("T")[0];
  const todayIdx = weekDays.indexOf(today);

  const validData = weekData.filter((d): d is DayData => d !== null);
  const avgHR = avg(validData.map((d) => d.heartRate));
  const avgHRV = avg(validData.map((d) => d.hrv));
  const avgSleep = validData.length
    ? (validData.reduce((a, d) => a + d.sleepHours, 0) / validData.length).toFixed(1)
    : "—";
  const avgStress = avg(validData.map((d) => d.stressScore));
  const avgScore = avg(validScores);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [weekOffset]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Week navigator */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log(`[History] Week changed to offset ${weekOffset - 1}`);
            onWeekChange(weekOffset - 1);
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={18} color={COLORS.textSecondary} />
        </AnimatedPressable>

        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: COLORS.text,
              fontFamily: "SpaceGrotesk-Bold",
            }}
          >
            {isCurrentWeek ? "Cette semaine" : weekLabel}
          </Text>
          {!isCurrentWeek && (
            <Text
              style={{
                fontSize: 11,
                color: COLORS.textTertiary,
                fontFamily: "SpaceGrotesk-Regular",
                marginTop: 2,
              }}
            >
              {weekLabel}
            </Text>
          )}
        </View>

        <AnimatedPressable
          onPress={() => {
            if (weekOffset < 0) {
              console.log(`[History] Week changed to offset ${weekOffset + 1}`);
              onWeekChange(weekOffset + 1);
            }
          }}
          disabled={weekOffset >= 0}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: weekOffset >= 0 ? "transparent" : COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={18} color={weekOffset >= 0 ? COLORS.textTertiary : COLORS.textSecondary} />
        </AnimatedPressable>
      </View>

      {/* Score bar chart */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: COLORS.textSecondary,
              fontFamily: "SpaceGrotesk-SemiBold",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Score santé
          </Text>
          {avgScore > 0 && (
            <View
              style={{
                backgroundColor: `${getScoreColor(avgScore)}18`,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: `${getScoreColor(avgScore)}30`,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: getScoreColor(avgScore),
                  fontFamily: "SpaceGrotesk-Bold",
                }}
              >
                Moy. {avgScore}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
          {weekDays.map((date, i) => (
            <DayBar
              key={date}
              value={scores[i]}
              maxValue={maxScore}
              color={getScoreColor(scores[i])}
              label={DAY_LABELS[i]}
              isToday={i === todayIdx}
              isBest={scores[i] > 0 && i === bestIdx}
              isWorst={scores[i] > 0 && i === worstIdx && bestIdx !== worstIdx}
              index={i}
            />
          ))}
        </View>

        {validData.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textTertiary,
                fontFamily: "SpaceGrotesk-Regular",
              }}
            >
              Aucune donnée pour cette semaine
            </Text>
          </View>
        )}
      </View>

      {/* Weekly averages */}
      {validData.length > 0 && (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: COLORS.textSecondary,
              fontFamily: "SpaceGrotesk-SemiBold",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 4,
            }}
          >
            Moyennes hebdomadaires
          </Text>

          <StatRow
            icon={<Heart size={15} color={COLORS.danger} />}
            label="Fréquence cardiaque"
            value={`${avgHR} bpm`}
          />
          <StatRow
            icon={<Activity size={15} color={COLORS.success} />}
            label="HRV moyen"
            value={`${avgHRV} ms`}
            trend={avgHRV >= 50 ? "up" : "down"}
          />
          <StatRow
            icon={<Moon size={15} color={COLORS.accent} />}
            label="Sommeil moyen"
            value={`${avgSleep} h`}
            trend={Number(avgSleep) >= 7 ? "up" : "down"}
          />
          <StatRow
            icon={<Zap size={15} color={COLORS.warning} />}
            label="Stress moyen"
            value={`${avgStress}%`}
            trend={avgStress < 40 ? "up" : avgStress > 65 ? "down" : "neutral"}
          />
        </View>
      )}
    </Animated.View>
  );
}
