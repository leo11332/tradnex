import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '@/constants/TradnexColors';

interface StressGaugeProps {
  value: number | null;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function getStressColor(value: number): string {
  if (value < 40) return COLORS.success;
  if (value <= 70) return COLORS.warning;
  return COLORS.danger;
}

function getStressLabel(value: number): string {
  if (value < 40) return 'LOW';
  if (value <= 70) return 'MODERATE';
  if (value <= 85) return 'HIGH';
  return 'CRITICAL';
}

const START_ANGLE = 130;
const END_ANGLE = 410; // 130 + 280
const SWEEP = 280;

export function StressGauge({ value, size = 240 }: StressGaugeProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 40) / 2;
  const strokeWidth = 16;

  useEffect(() => {
    const target = value ?? 0;
    Animated.timing(animatedValue, {
      toValue: target,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const displayValue = value ?? 0;
  const color = value !== null ? getStressColor(displayValue) : COLORS.textTertiary;
  const label = value !== null ? getStressLabel(displayValue) : '--';

  // Background arc (full sweep)
  const bgPath = describeArc(cx, cy, radius, START_ANGLE, END_ANGLE);

  // Foreground arc (animated)
  const fgEndAngle = START_ANGLE + (displayValue / 100) * SWEEP;
  const fgPath = displayValue > 0 ? describeArc(cx, cy, radius, START_ANGLE, fgEndAngle) : null;

  const displayText = value !== null ? String(Math.round(displayValue)) : '--';

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background track */}
          <Path
            d={bgPath}
            stroke={COLORS.surfaceElevated}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          {fgPath && (
            <Path
              d={fgPath}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          )}
          {/* Center dot */}
          <Circle cx={cx} cy={cy} r={4} fill={color} opacity={0.6} />
        </Svg>
        {/* Center text */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 56,
              fontWeight: '700',
              color: COLORS.text,
              fontFamily: 'SpaceGrotesk-Bold',
              fontVariant: ['tabular-nums'],
              letterSpacing: -2,
            }}
          >
            {displayText}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: COLORS.textSecondary,
              letterSpacing: 2,
              fontFamily: 'SpaceGrotesk-Medium',
              marginTop: 2,
            }}
          >
            STRESS
          </Text>
        </View>
      </View>
      {/* Stress level badge */}
      <View
        style={{
          marginTop: 12,
          paddingHorizontal: 16,
          paddingVertical: 6,
          borderRadius: 20,
          backgroundColor: value !== null ? `${color}20` : COLORS.surfaceSecondary,
          borderWidth: 1,
          borderColor: value !== null ? `${color}40` : COLORS.border,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: value !== null ? color : COLORS.textTertiary,
            letterSpacing: 2,
            fontFamily: 'SpaceGrotesk-Bold',
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
