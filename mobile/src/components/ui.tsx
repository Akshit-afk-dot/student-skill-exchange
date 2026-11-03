import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme';
import { haptics } from '../utils/haptics';
import { useCountUp } from '../hooks/useCountUp';
import { LAYOUT_ANIMATIONS_SUPPORTED, PressableScale } from './motion';

/** Screen wrapper: safe-area aware, themed background, optional scrolling. */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['top'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const inner: StyleProp<ViewStyle> = [padded && { padding: t.spacing.lg }, style];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={() => {
                  haptics.tap();
                  onRefresh();
                }}
                tintColor={t.colors.primary}
                colors={[t.colors.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* ---------- Typography ---------- */

export function Display({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.display, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Title({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.title, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Heading({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.heading, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  small = false,
  numberOfLines,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        small ? t.typography.bodySmall : t.typography.body,
        { color: muted ? t.colors.textMuted : t.colors.text },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Caption({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[t.typography.caption, { color: t.colors.textMuted }, style]}
    >
      {children}
    </Text>
  );
}

/** Small uppercase label that opens a section. */
export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: t.colors.textMuted,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ---------- Surfaces ---------- */

export function Card({
  children,
  onPress,
  style,
  elevated = 1,
  tint,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevated?: 0 | 1 | 2 | 3;
  /** Optional background tint, for cards that need to stand out. */
  tint?: string;
}) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: tint ?? t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
    },
    t.elevation(elevated),
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <PressableScale onPress={onPress} style={base} scaleTo={0.98}>
      {children}
    </PressableScale>
  );
}

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  haptic,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  /** Override the default feel; primary presses are weightier than ghost ones. */
  haptic?: keyof typeof haptics | null;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const fg =
    variant === 'primary' || variant === 'danger' ? t.colors.textInverse : t.colors.text;

  const defaultHaptic: keyof typeof haptics =
    variant === 'primary' ? 'press' : variant === 'danger' ? 'reject' : 'tap';

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 15, fontWeight: '600', letterSpacing: 0.1 }}>
            {label}
          </Text>
        </>
      )}
    </>
  );

  const shape: ViewStyle = {
    borderRadius: t.radius.md,
    paddingVertical: 14,
    paddingHorizontal: t.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  };

  // Primary gets a gradient; the rest stay flat so the hierarchy reads at a glance.
  if (variant === 'primary' && !isDisabled) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={isDisabled}
        haptic={haptic === undefined ? defaultHaptic : haptic}
        accessibilityLabel={label}
        style={[{ borderRadius: t.radius.md, alignSelf: fullWidth ? 'stretch' : 'flex-start' }, t.elevation(1), style]}
      >
        <LinearGradient
          colors={t.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shape}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  const bg =
    variant === 'primary'
      ? t.colors.primary
      : variant === 'danger'
        ? t.colors.danger
        : variant === 'secondary'
          ? t.colors.surfaceAlt
          : 'transparent';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic === undefined ? defaultHaptic : haptic}
      accessibilityLabel={label}
      style={[
        shape,
        {
          backgroundColor: bg,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.colors.borderStrong,
        },
        variant === 'danger' ? t.elevation(1) : undefined,
        // Dimmed only when actually unavailable: a loading button is busy, not off limits.
        disabled ? { opacity: 0.45 } : undefined,
        style,
      ]}
    >
      {content}
    </PressableScale>
  );
}

/* ---------- Form ---------- */

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTheme();

  // A newly-appearing error should announce itself rather than just materialise.
  return (
    <View style={{ marginBottom: t.spacing.lg }}>
      <Overline style={{ marginBottom: 6 }}>{label}</Overline>
      {children}
      {error ? (
        <Animated.View
          entering={LAYOUT_ANIMATIONS_SUPPORTED ? FadeInDown.duration(t.motion.fast) : undefined}
        >
          <Text style={{ color: t.colors.danger, fontSize: 12, marginTop: 5, fontWeight: '500' }}>
            {error}
          </Text>
        </Animated.View>
      ) : hint ? (
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 5 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({ error, style, onFocus, onBlur, ...props }: TextInputProps & { error?: boolean }) {
  const t = useTheme();
  const focus = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: focus.value > 0.5 ? t.colors.primary : error ? t.colors.danger : t.colors.border,
    borderWidth: interpolate(focus.value, [0, 1], [StyleSheet.hairlineWidth, 1.6]),
  }));

  return (
    <Animated.View style={[{ borderRadius: t.radius.md }, animatedStyle]}>
      <TextInput
        placeholderTextColor={t.colors.textMuted}
        onFocus={(e) => {
          focus.value = withTiming(1, { duration: t.motion.instant });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focus.value = withTiming(0, { duration: t.motion.instant });
          onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.md,
            paddingVertical: 13,
            fontSize: 15,
            color: t.colors.text,
          },
          style,
        ]}
        {...props}
      />
    </Animated.View>
  );
}

/* ---------- Identity ---------- */

export function Avatar({
  name,
  uri,
  size = 44,
  online,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
}) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={t.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>
            {initials || '?'}
          </Text>
        </LinearGradient>
      )}
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: t.colors.success,
            borderWidth: 2.5,
            borderColor: t.colors.surface,
          }}
        />
      ) : null}
    </View>
  );
}

/* ---------- Chips & ratings ---------- */

type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

function toneColours(t: Theme, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'primary':
      return { bg: t.colors.primarySoft, fg: t.colors.primary };
    case 'accent':
      return { bg: t.colors.accentSoft, fg: t.colors.accent };
    case 'success':
      return { bg: t.colors.successSoft, fg: t.colors.success };
    case 'warning':
      return { bg: t.colors.warningSoft, fg: t.colors.warning };
    case 'danger':
      return { bg: t.colors.dangerSoft, fg: t.colors.danger };
    default:
      return { bg: t.colors.surfaceAlt, fg: t.colors.textMuted };
  }
}

export function Chip({
  label,
  tone = 'neutral',
  icon,
  onPress,
  selected,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  selected?: boolean;
}) {
  const t = useTheme();
  const c = selected ? toneColours(t, 'primary') : toneColours(t, tone);

  const scale = useSharedValue(1);
  useEffect(() => {
    // A small pop confirms the selection changed without needing a colour hunt.
    scale.value = withSpring(selected ? 1.04 : 1, t.motion.pressSpring);
  }, [selected, scale, t.motion.pressSpring]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: c.bg,
          borderRadius: t.radius.pill,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderWidth: selected ? 1.4 : 0,
          borderColor: t.colors.primary,
        },
        animatedStyle,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </Animated.View>
  );

  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} haptic="selection" scaleTo={0.94} accessibilityLabel={label}>
      {body}
    </PressableScale>
  );
}

export function StarRating({
  value,
  count,
  size = 14,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
  const t = useTheme();
  if (!value && !count) return <Caption>No ratings yet</Caption>;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={size} color={t.colors.star} />
      {showValue ? (
        <Text
          style={{
            color: t.colors.text,
            fontSize: size - 1,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {value.toFixed(1)}
        </Text>
      ) : null}
      {count !== undefined ? (
        <Text style={{ color: t.colors.textMuted, fontSize: size - 2 }}>({count})</Text>
      ) : null}
    </View>
  );
}

/** Tappable 1-5 star input. Each star pops and ticks as it is selected. */
export function StarPicker({
  value,
  onChange,
  size = 38,
}: {
  value: number;
  onChange(next: number): void;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarButton key={n} n={n} value={value} size={size} onChange={onChange} theme={t} />
      ))}
    </View>
  );
}

function StarButton({
  n,
  value,
  size,
  onChange,
  theme,
}: {
  n: number;
  value: number;
  size: number;
  onChange(next: number): void;
  theme: Theme;
}) {
  const filled = n <= value;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!filled) {
      scale.value = withSpring(1, theme.motion.pressSpring);
      return;
    }
    // Stagger by position so selecting 4 stars ripples left to right.
    scale.value = withDelay(
      n * 45,
      withSpring(1.25, theme.motion.pressSpring, () => {
        scale.value = withSpring(1, theme.motion.pressSpring);
      }),
    );
  }, [filled, n, scale, theme.motion.pressSpring]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onChange(n);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: value === n }}
      accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
      hitSlop={6}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={size}
          color={filled ? theme.colors.star : theme.colors.borderStrong}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ---------- States ---------- */

export function LoadingView({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl }}>
      <ActivityIndicator color={t.colors.primary} />
      {label ? <Caption style={{ marginTop: t.spacing.md }}>{label}</Caption> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <Animated.View
      entering={LAYOUT_ANIMATIONS_SUPPORTED ? FadeIn.duration(t.motion.slow) : undefined}
      style={{ alignItems: 'center', paddingVertical: t.spacing.xxl, paddingHorizontal: t.spacing.lg }}
    >
      <LinearGradient
        colors={[t.colors.primarySoft, t.colors.surfaceAlt]}
        style={{
          width: 74,
          height: 74,
          borderRadius: 37,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.lg,
        }}
      >
        <Ionicons name={icon} size={32} color={t.colors.primary} />
      </LinearGradient>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? (
        <Body muted style={{ textAlign: 'center', marginTop: t.spacing.sm, lineHeight: 21 }}>
          {message}
        </Body>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={{ marginTop: t.spacing.lg }}
        />
      ) : null}
    </Animated.View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

export function Banner({ tone = 'primary', text }: { tone?: Tone; text: string }) {
  const t = useTheme();
  const c = toneColours(t, tone);

  // Errors that appear mid-flow should be felt, not just seen.
  useEffect(() => {
    if (tone === 'danger') haptics.error();
    else if (tone === 'success') haptics.success();
  }, [tone, text]);

  return (
    <Animated.View
      entering={
        LAYOUT_ANIMATIONS_SUPPORTED
          ? FadeInDown.duration(t.motion.fast).springify().damping(18)
          : undefined
      }
      style={{
        backgroundColor: c.bg,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        marginBottom: t.spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: c.fg,
      }}
      accessibilityRole="alert"
    >
      <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500', lineHeight: 19 }}>{text}</Text>
    </Animated.View>
  );
}

/* ---------- Layout ---------- */

export function Divider({ spacing: gap }: { spacing?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: t.colors.border,
        marginVertical: gap ?? t.spacing.md,
      }}
    />
  );
}

export function Row({
  children,
  gap,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: gap ?? t.spacing.sm }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: t.spacing.md,
      }}
    >
      <Heading>{title}</Heading>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic="tap" scaleTo={0.94}>
          <Row gap={2}>
            <Text style={{ color: t.colors.primary, fontSize: 14, fontWeight: '600' }}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={t.colors.primary} />
          </Row>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * Compact statistic tile. The number counts up on mount, which makes a dashboard feel
 * like it is reporting something rather than just rendering.
 */
export function StatTile({
  label,
  value,
  icon,
  tone = 'primary',
  index = 0,
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  index?: number;
}) {
  const t = useTheme();
  const c = toneColours(t, tone);

  const numeric = typeof value === 'number' ? value : null;
  // Fractional stats (hours) keep a decimal; counts stay whole.
  const decimals = numeric !== null && !Number.isInteger(numeric) ? 1 : 0;
  const counted = useCountUp(numeric ?? 0, { duration: 800, delay: index * 70, decimals });

  return (
    <Animated.View
      entering={
        LAYOUT_ANIMATIONS_SUPPORTED
          ? FadeInDown.delay(index * 70).duration(t.motion.normal).springify().damping(18)
          : undefined
      }
      style={[
        {
          flex: 1,
          minWidth: 96,
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
          padding: t.spacing.md,
        },
        t.elevation(1),
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: c.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Ionicons name={icon} size={15} color={c.fg} />
        </View>
      ) : null}

      <Text style={[t.typography.numeric, { color: t.colors.text }]}>
        {numeric === null ? value : decimals > 0 ? counted.toFixed(1) : counted}
      </Text>

      <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={2}>
        {label}
      </Text>
    </Animated.View>
  );
}

export type { Theme };

/** A student's name, with a tick beside it once they have confirmed their email. */
export function VerifiedName({
  name,
  verified,
  size = 'heading',
}: {
  name: string;
  verified?: boolean;
  size?: 'heading' | 'title';
}) {
  const t = useTheme();
  const isTitle = size === 'title';
  const shrink = { flexShrink: 1 };
  return (
    <Row gap={6}>
      {isTitle ? (
        <Title numberOfLines={2} style={shrink}>
          {name}
        </Title>
      ) : (
        <Heading numberOfLines={1} style={shrink}>
          {name}
        </Heading>
      )}
      {verified ? (
        <Ionicons
          name="checkmark-circle"
          size={isTitle ? 20 : 16}
          color={t.colors.primary}
          accessibilityLabel="Verified email"
        />
      ) : null}
    </Row>
  );
}
