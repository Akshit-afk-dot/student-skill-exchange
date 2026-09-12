import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { useCountUp } from '../hooks/useCountUp';

/**
 * Circular match-score dial.
 *
 * The arc sweeps up from zero rather than appearing filled, which makes the score read
 * as something the app *computed* — worth doing here because the match percentage is the
 * headline output of the whole system.
 *
 * Both the arc and the number are driven by one counted value, so they can never
 * disagree mid-animation, and it renders identically on native and web.
 */
export function ScoreRing({
  percent,
  size = 72,
  strokeWidth = 7,
  label,
  delay = 0,
  twoWay = false,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  delay?: number;
  /** Reciprocal exchanges get the success gradient instead of the primary one. */
  twoWay?: boolean;
}) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const shown = useCountUp(clamped, { duration: 900, delay });
  const offset = circumference * (1 - shown / 100);

  const gradientId = `ring-${twoWay ? 'two' : 'one'}`;
  const [from, to] = twoWay
    ? [t.colors.success, t.colors.accent]
    : [t.colors.primary, t.colors.primaryDeep];

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`${clamped} percent match`}
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
          stroke={t.colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Rotated so the arc starts at twelve o'clock rather than three. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
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
              fontSize: size * 0.28,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {shown}
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: size * 0.16, fontWeight: '700' }}>
            %
          </Text>
        </View>
        {label ? (
          <Text style={{ color: t.colors.textMuted, fontSize: size * 0.13, fontWeight: '600' }}>
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
    <View style={{ marginBottom: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: t.colors.text, fontSize: 13 }}>
          {label}
          {weight !== undefined ? (
            <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>
              {'  '}
              {Math.round(weight * 100)}% of score
            </Text>
          ) : null}
        </Text>
        <Text
          style={{
            color: t.colors.textMuted,
            fontSize: 12,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
          }}
        >
          {shown}
        </Text>
      </View>

      <View
        style={{
          height: 7,
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
