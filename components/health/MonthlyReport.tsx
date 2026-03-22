import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Activity, Moon, Heart, Zap } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { DayData, getHealthScore, getScoreColor } from "./DayCard";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const DAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function getMonthDays(monthOffset: number): { year: number; month: number } {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  return { year: target.getFullYear(), month: target.getMonth() };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

interface CalendarDayProps {
  day: number | null;
  score: number;
  isToday: boolean;
  index: number;
}

function CalendarDay({ day, score, isToday, index }: CalendarDayProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      delay: index * 15,
      useNativeDriver: true,
    }).start();
  }, []);

  if (day === null) {
    return <View style={{ flex: 1, aspectRatio: 1 }} />;
  }

  const hasData = score > 0;
  const color = hasData ? getScoreColor(score) : COLORS.surfaceSecondary;
  const dayStr = String(day);

  return (
    <Animated.View style={{ opacity, flex: 1, aspectRatio: 1, padding: 2 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 8,
          backgroundColor: hasData ? `${color}22` : COLORS.surfaceSecondary,
          borderWidth: 1,
          borderColor: isToday ? COLORS.primary : hasData ? `${color}40` : COLORS.divider,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: isToday ? "700" : "500",
            color: isToday ? COLORS.primary : hasData ? color : COLORS.textTertiary,
            fontFamily: isToday ? "SpaceGrotesk-Bold" : "SpaceGrotesk-Regular",
          }}
        >
          {dayStr}
        </Text>
        {hasData && (
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: color,
              marginTop: 1,
            }}
          />
        )}
      </View>
    </Animated.View>
  );
}

interface WeekRowProps {
  label: string;
  avgScore: number;
  days: Array<{ day: number | null; score: number; isToday: boolean }>;
  startIndex: number;
}

function WeekRow({ label, avgScore, days, startIndex }: WeekRowProps) {
  const hasData = avgScore > 0;
  const color = hasData ? getScoreColor(avgScore) : COLORS.textTertiary;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <View style={{ width: 36, alignItems: "center" }}>
        {hasData ? (
          <View
            style={{
              backgroundColor: `${color}18`,
              borderRadius: 6,
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: color,
                fontFamily: "SpaceGrotesk-Bold",
              }}
            >
              {avgScore}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 10,
              color: COLORS.textTertiary,
              fontFamily: "SpaceGrotesk-Regular",
            }}
          >
            {label}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {days.map((d, i) => (
          <CalendarDay
            key={i}
            day={d.day}
            score={d.score}
            isToday={d.isToday}
            index={startIndex + i}
          />
        ))}
      </View>
    </View>
  );
}

interface TrendCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  prevValue: string;
  trend: "up" | "down" | "neutral";
  goodDirection: "up" | "down";
}

function TrendCard({ icon, label, value, prevValue, trend, goodDirection }: TrendCardProps) {
  const isGood = trend === goodDirection;
  const isNeutral = trend === "neutral";
  const trendColor = isNeutral ? COLORS.textTertiary : isGood ? COLORS.success : COLORS.danger;
  const TrendIcon = isNeutral ? Minus : trend === "up" ? TrendingUp : TrendingDown;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon}
        <Text
          style={{
            fontSize: 11,
            color: COLORS.textSecondary,
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
          color: COLORS.text,
          fontFamily: "SpaceGrotesk-Bold",
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
        <TrendIcon size={11} color={trendColor} />
        <Text
          style={{
            fontSize: 11,
            color: trendColor,
            fontFamily: "SpaceGrotesk-Regular",
          }}
        >
          {prevValue}
        </Text>
      </View>
    </View>
  );
}

interface MonthlyReportProps {
  allData: DayData[];
  monthOffset: number;
  onMonthChange: (offset: number) => void;
}

export function MonthlyReport({ allData, monthOffset, onMonthChange }: MonthlyReportProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { year, month } = getMonthDays(monthOffset);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const isCurrentMonth = monthOffset === 0;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Build score map
  const scoreMap: Record<string, number> = {};
  allData.forEach((d) => {
    const score = getHealthScore(d);
    scoreMap[d.date] = score;
  });

  // Build calendar grid
  const totalCells = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
  const cells: Array<{ day: number | null; date: string | null; score: number; isToday: boolean }> = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ day: null, date: null, score: 0, isToday: false });
    } else {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      cells.push({
        day: dayNum,
        date: dateStr,
        score: scoreMap[dateStr] ?? 0,
        isToday: dateStr === todayStr,
      });
    }
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Monthly stats
  const monthDataStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthData = allData.filter((d) => d.date.startsWith(monthDataStr));

  // Previous month stats
  const prevMonthDate = getMonthDays(monthOffset - 1);
  const prevMonthStr = `${prevMonthDate.year}-${String(prevMonthDate.month + 1).padStart(2, "0")}`;
  const prevMonthData = allData.filter((d) => d.date.startsWith(prevMonthStr));

  const avgHR = avg(monthData.map((d) => d.heartRate));
  const avgHRV = avg(monthData.map((d) => d.hrv));
  const avgSleep = monthData.length
    ? (monthData.reduce((a, d) => a + d.sleepHours, 0) / monthData.length).toFixed(1)
    : "—";
  const avgStress = avg(monthData.map((d) => d.stressScore));

  const prevAvgHR = avg(prevMonthData.map((d) => d.heartRate));
  const prevAvgHRV = avg(prevMonthData.map((d) => d.hrv));
  const prevAvgSleep = prevMonthData.length
    ? (prevMonthData.reduce((a, d) => a + d.sleepHours, 0) / prevMonthData.length).toFixed(1)
    : "—";
  const prevAvgStress = avg(prevMonthData.map((d) => d.stressScore));

  function getTrend(current: number, prev: number): "up" | "down" | "neutral" {
    if (!prev || !current) return "neutral";
    const diff = current - prev;
    if (Math.abs(diff) < 2) return "neutral";
    return diff > 0 ? "up" : "down";
  }

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [monthOffset]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Month navigator */}
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
            console.log(`[History] Month changed to offset ${monthOffset - 1}`);
            onMonthChange(monthOffset - 1);
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

        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: COLORS.text,
            fontFamily: "SpaceGrotesk-Bold",
          }}
        >
          {isCurrentMonth ? "Ce mois-ci" : `${MONTH_NAMES[month]} ${year}`}
        </Text>

        <AnimatedPressable
          onPress={() => {
            if (monthOffset < 0) {
              console.log(`[History] Month changed to offset ${monthOffset + 1}`);
              onMonthChange(monthOffset + 1);
            }
          }}
          disabled={monthOffset >= 0}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: monthOffset >= 0 ? "transparent" : COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={18} color={monthOffset >= 0 ? COLORS.textTertiary : COLORS.textSecondary} />
        </AnimatedPressable>
      </View>

      {/* Calendar */}
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
            marginBottom: 12,
          }}
        >
          {MONTH_NAMES[month]} {year}
        </Text>

        {/* Day headers */}
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <View style={{ width: 36 }} />
          {DAY_INITIALS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: COLORS.textTertiary,
                  fontFamily: "SpaceGrotesk-SemiBold",
                }}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar weeks */}
        {weeks.map((week, wi) => {
          const weekScores = week
            .filter((c) => c.score > 0)
            .map((c) => c.score);
          const weekAvg = avg(weekScores);
          const weekLabel = `S${wi + 1}`;
          return (
            <WeekRow
              key={wi}
              label={weekLabel}
              avgScore={weekAvg}
              days={week.map((c) => ({
                day: c.day,
                score: c.score,
                isToday: c.isToday,
              }))}
              startIndex={wi * 7}
            />
          );
        })}

        {/* Legend */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: COLORS.divider,
          }}
        >
          {[
            { color: COLORS.success, label: "Bon" },
            { color: COLORS.warning, label: "Moyen" },
            { color: COLORS.danger, label: "Faible" },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: item.color,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  color: COLORS.textTertiary,
                  fontFamily: "SpaceGrotesk-Regular",
                }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trend cards */}
      {monthData.length > 0 && (
        <>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
            <TrendCard
              icon={<Heart size={14} color={COLORS.danger} />}
              label="Fréq. cardiaque"
              value={`${avgHR} bpm`}
              prevValue={prevAvgHR ? `vs ${prevAvgHR} bpm` : "Pas de données"}
              trend={getTrend(avgHR, prevAvgHR)}
              goodDirection="down"
            />
            <TrendCard
              icon={<Activity size={14} color={COLORS.success} />}
              label="HRV moyen"
              value={`${avgHRV} ms`}
              prevValue={prevAvgHRV ? `vs ${prevAvgHRV} ms` : "Pas de données"}
              trend={getTrend(avgHRV, prevAvgHRV)}
              goodDirection="up"
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TrendCard
              icon={<Moon size={14} color={COLORS.accent} />}
              label="Sommeil"
              value={`${avgSleep} h`}
              prevValue={prevAvgSleep !== "—" ? `vs ${prevAvgSleep} h` : "Pas de données"}
              trend={getTrend(Number(avgSleep), Number(prevAvgSleep))}
              goodDirection="up"
            />
            <TrendCard
              icon={<Zap size={14} color={COLORS.warning} />}
              label="Stress"
              value={`${avgStress}%`}
              prevValue={prevAvgStress ? `vs ${prevAvgStress}%` : "Pas de données"}
              trend={getTrend(avgStress, prevAvgStress)}
              goodDirection="down"
            />
          </View>
        </>
      )}

      {monthData.length === 0 && (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 32,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: COLORS.textTertiary,
              fontFamily: "SpaceGrotesk-Regular",
              textAlign: "center",
            }}
          >
            Aucune donnée pour {MONTH_NAMES[month].toLowerCase()}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
