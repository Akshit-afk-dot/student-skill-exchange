import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { haptics } from '../haptics';
import { useCountUp } from '../hooks/useCountUp';
import { useTheme } from '../theme';
import { Text } from './Text';

/** How long the ring takes to fill. The haptic pattern is timed against this. */
export const SCORE_REVEAL_MS = 900;

/**
 * Circular match-score dial.
 *
 * The arc sweeps up from zero rather than appearing filled, which makes the score read
 * as something the app *computed* — worth doing here because the match percentage is the
 * headline output of the whole system.
 *
 * Both the arc and the number are driven by one counted value, so they can never
 * disagree mid-animation, and it renders identically on native and web.
 *
 * With `felt`, the fill is accompanied by haptics on the same curve: ticks that spread
 * apart as the ring slows, then a landing whose weight depends on the score. Use that
 * once per screen, on the ring the person came to see, never on every ring in a list.
 */
export function ScoreRing({
  percent,
  size = 72,
  strokeWidth,
  label,
  delay = 0,
  twoWay = false,
  felt = false,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  delay?: number;
  /** Reciprocal exchanges get the success gradient instead of the primary one. */
  twoWay?: boolean;
  /** Play the score-reveal haptic pattern alongside the fill. */
  felt?: boolean;
}) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = strokeWidth ?? Math.max(6, Math.round(size * 0.11));

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const shown = useCountUp(clamped, { duration: SCORE_REVEAL_MS, delay });
  const offset = circumference * (1 - shown / 100);

  useEffect(() => {
    if (!felt) return;
    let cancel: (() => void) | undefined;
    // Started after the same delay as the count-up, so the two stay in step.
    const timer = setTimeout(() => {
      cancel = haptics.scoreReveal(clamped, SCORE_REVEAL_MS, twoWay);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
  }, [felt, clamped, twoWay, delay]);

  const gradientId = `ring-${twoWay ? 'two' : 'one'}-${size}`;
  const [from, to] = twoWay
    ? [t.colors.success, t.colors.accent]
    : [t.dark ? '#B4ABFF' : '#7C6BFF', t.colors.primaryDeep];

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`${clamped} percent match${twoWay ? ', two-way exchange' : ''}`}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={twoWay ? t.colors.successSoft : t.colors.primarySoft}
          strokeWidth={stroke}
          fill="none"
        />

        {/* Rotated so the arc starts at twelve o'clock rather than three. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              color: t.colors.text,
              fontSize: size * 0.3,
              lineHeight: size * 0.36,
              fontWeight: '800',
              letterSpacing: -0.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {shown}
          </Text>
          <Text
            style={{
              color: t.colors.textMuted,
              fontSize: Math.max(11, size * 0.15),
              fontWeight: '700',
            }}
          >
            %
          </Text>
        </View>
        {label ? (
          <Text
            style={{
              color: t.colors.textMuted,
              fontSize: Math.max(11, size * 0.11),
              fontWeight: '600',
              marginTop: -2,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Horizontal bar for one score component, used in the "why this match" breakdown.
 * Bars fill in sequence so the eye follows down the list.
 */
export function ScoreBar({
  label,
  value,
  weight,
  index = 0,
}: {
  label: string;
  /** 0..1 */
  value: number;
  /** 0..1 — the weight this component carries in the final score. */
  weight?: number;
  index?: number;
}) {
  const t = useTheme();
  const target = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const shown = useCountUp(target, { duration: 700, delay: index * 80 });

  return (
    <View style={{ marginBottom: t.spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <Text style={{ color: t.colors.text, fontSize: 14, lineHeight: 19, fontWeight: '600' }}>
          {label}
          {weight !== undefined ? (
            <Text style={{ color: t.colors.textMuted, fontSize: 12, fontWeight: '500' }}>
              {'  '}
              {Math.round(weight * 100)}% of score
            </Text>
          ) : null}
        </Text>
        <Text
          style={{
            color: t.colors.text,
            fontSize: 14,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {shown}
        </Text>
      </View>

      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: t.colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${shown}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: t.colors.primary,
          }}
        />
      </View>
    </View>
  );
}
