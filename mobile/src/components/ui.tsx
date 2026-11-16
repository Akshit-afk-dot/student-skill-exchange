import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { haptics } from '../haptics';
import { useCountUp } from '../hooks/useCountUp';
import { useTheme, type Theme } from '../theme';
import { Button, IconButton } from './Button';
import { LAYOUT_ANIMATIONS_SUPPORTED, PressableScale } from './motion';
import { Text } from './Text';

export { Button, IconButton, Text };
export type { ButtonSize, ButtonVariant } from './Button';

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
  const inner: StyleProp<ViewStyle> = [
    padded && { paddingHorizontal: t.spacing.page, paddingVertical: t.spacing.lg },
    style,
  ];

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
                  // Felt at the moment the pull commits, like a latch catching.
                  haptics.refresh();
                  onRefresh();
                }}
                tintColor={t.colors.primary}
                colors={[t.colors.primary]}
                progressBackgroundColor={t.colors.surface}
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

interface TypeProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function Display({ children, style, numberOfLines }: TypeProps) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole="header"
      style={[t.typography.display, { color: t.colors.text }, style]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style, numberOfLines }: TypeProps) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole="header"
      style={[t.typography.title, { color: t.colors.text }, style]}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, style, numberOfLines }: TypeProps) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.typography.heading, { color: t.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Subheading({ children, style, numberOfLines }: TypeProps) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[t.typography.subheading, { color: t.colors.text }, style]}
    >
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
}: TypeProps & { muted?: boolean; small?: boolean }) {
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

export function Caption({ children, style, numberOfLines }: TypeProps) {
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
  return <Text style={[t.typography.overline, { color: t.colors.textMuted }, style]}>{children}</Text>;
}

/* ---------- Surfaces ---------- */

export function Card({
  children,
  onPress,
  style,
  elevated = 1,
  tint,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevated?: 0 | 1 | 2 | 3;
  /** Optional background tint, for cards that need to stand out. */
  tint?: string;
  accessibilityLabel?: string;
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
    <PressableScale onPress={onPress} style={base} scaleTo={0.98} accessibilityLabel={accessibilityLabel}>
      {children}
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
      <Text
        style={{
          color: t.colors.text,
          fontSize: 14,
          lineHeight: 19,
          fontWeight: '600',
          marginBottom: 7,
        }}
      >
        {label}
      </Text>
      {children}
      {error ? (
        <Animated.View
          entering={LAYOUT_ANIMATIONS_SUPPORTED ? FadeInDown.duration(t.motion.fast) : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}
        >
          <Ionicons name="alert-circle" size={14} color={t.colors.danger} />
          <Text style={{ color: t.colors.danger, fontSize: 13, lineHeight: 17, fontWeight: '500', flex: 1 }}>
            {error}
          </Text>
        </Animated.View>
      ) : hint ? (
        <Text style={{ color: t.colors.textMuted, fontSize: 13, lineHeight: 17, marginTop: 6 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Text input. A filled well rather than an outlined box: the border only appears on
 * focus (brand) or error (red), so the one field being edited is the one that stands out.
 */
export function Input({
  error,
  style,
  icon,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  error?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: props.multiline ? 'flex-start' : 'center',
          backgroundColor: focused ? t.colors.surface : t.colors.surfaceAlt,
          borderRadius: t.radius.md,
          borderWidth: 1.5,
          borderColor: error ? t.colors.danger : focused ? t.colors.primary : 'transparent',
        },
        containerStyle,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={focused ? t.colors.primary : t.colors.textMuted}
          style={{ marginLeft: 14, marginTop: props.multiline ? 15 : 0 }}
        />
      ) : null}
      <TextInput
        placeholderTextColor={t.colors.textMuted}
        selectionColor={t.colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            minHeight: 50,
            paddingHorizontal: icon ? 10 : 15,
            paddingVertical: 13,
            fontFamily: t.fonts.regular,
            fontSize: 16,
            color: t.colors.text,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

/* ---------- Identity ---------- */

// Deep enough that white initials stay legible on every pair.
const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#6D5BFF', '#4B3AD6'],
  ['#EA670C', '#C2410C'],
  ['#0E9494', '#087070'],
  ['#DB3F78', '#B02460'],
  ['#3373E0', '#2456C9'],
  ['#129A52', '#0A773C'],
];

/** The same name always gets the same colour, so a person is recognisable across screens. */
function gradientFor(name: string): readonly [string, string] {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length] ?? ['#6D5BFF', '#4B3AD6'];
}

export function Avatar({
  name,
  uri,
  size = 44,
  online,
  ring,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
  /** A coloured ring around the avatar, used to mark a two-way match. */
  ring?: string;
}) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const inner = ring ? size - 8 : size;

  const face = uri ? (
    <Image
      source={{ uri }}
      style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: t.colors.surfaceAlt }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <LinearGradient
      colors={gradientFor(name)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: inner,
        height: inner,
        borderRadius: inner / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: inner * 0.38, letterSpacing: 0.3 }}>
        {initials || '?'}
      </Text>
    </LinearGradient>
  );

  return (
    <View
      style={
        ring
          ? {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2.5,
              borderColor: ring,
              alignItems: 'center',
              justifyContent: 'center',
            }
          : undefined
      }
    >
      {face}
      {online ? (
        <View
          accessibilityLabel="Online"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: Math.max(12, size * 0.28),
            height: Math.max(12, size * 0.28),
            borderRadius: size * 0.14 + 6,
            backgroundColor: t.dark ? '#4ADE94' : '#16B364',
            borderWidth: 2.5,
            borderColor: t.colors.surface,
          }}
        />
      ) : null}
    </View>
  );
}

/* ---------- Chips & ratings ---------- */

export type Tone =
  | 'neutral'
  | 'primary'
  | 'teach'
  | 'learn'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

export function toneColours(t: Theme, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'primary':
    case 'teach':
      return { bg: t.colors.primarySoft, fg: t.colors.primary };
    case 'learn':
      return { bg: t.colors.learnSoft, fg: t.colors.learn };
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

/**
 * A chip. Without `onPress` it is a label. With it, it is a choice: a selected chip
 * fills with the brand colour so the state reads at a glance, not by comparing tints.
 *
 * `teach` (violet) and `learn` (orange) are the two tones with a fixed meaning: they mark
 * skills offered and skills wanted, everywhere in the app.
 */
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
  const c = selected ? { bg: t.colors.primary, fg: t.colors.onPrimary } : toneColours(t, tone);
  const interactive = Boolean(onPress);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (selected === undefined) return;
    // A small pop confirms the selection changed without needing a colour hunt.
    scale.value = withSpring(selected ? 1.06 : 1, t.motion.springs.spatialFast, () => {
      scale.value = withSpring(1, t.motion.springs.spatialFast);
    });
  }, [selected, scale, t.motion.springs.spatialFast]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const body = (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: c.bg,
          borderRadius: t.radius.pill,
          paddingHorizontal: interactive ? 15 : 12,
          minHeight: interactive ? 38 : 30,
          borderWidth: interactive && !selected ? StyleSheet.hairlineWidth : 0,
          borderColor: t.colors.border,
        },
        animatedStyle,
      ]}
    >
      {icon ? <Ionicons name={icon} size={interactive ? 15 : 13} color={c.fg} /> : null}
      <Text
        numberOfLines={1}
        style={{ color: c.fg, fontSize: interactive ? 14 : 13, lineHeight: 18, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Animated.View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      hitSlop={4}
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {body}
    </PressableScale>
  );
}

/**
 * A row of mutually exclusive options with a thumb that slides to the chosen one.
 * For two to four short choices that switch what a screen shows.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }>;
  value: T;
  onChange(next: T): void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = options.length > 0 ? (width - 8) / options.length : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (segment === 0) return;
    // Placed instantly the first time, so a preselected option does not slide in on mount.
    if (!placed.current) {
      placed.current = true;
      x.value = index * segment;
      return;
    }
    x.value = withSpring(index * segment, t.motion.springs.spatialFast);
  }, [index, segment, x, t.motion.springs.spatialFast]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.surfaceAlt,
        borderRadius: t.radius.md,
        padding: 4,
      }}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: segment,
              borderRadius: t.radius.md - 4,
              // Raised above its track in both schemes: white on grey in light mode, and
              // a lighter tone in dark mode, where shadows do not read.
              backgroundColor: t.dark ? t.colors.borderStrong : t.colors.surface,
            },
            t.elevation(1),
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              minHeight: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={15}
                color={active ? t.colors.primary : t.colors.textMuted}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                color: active ? t.colors.text : t.colors.textMuted,
                fontSize: 14,
                lineHeight: 19,
                fontWeight: active ? '700' : '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel={`Rated ${value.toFixed(1)} out of 5${count !== undefined ? `, ${count} reviews` : ''}`}
    >
      <Ionicons name="star" size={size} color={t.colors.star} />
      {showValue ? (
        <Text
          style={{
            color: t.colors.text,
            fontSize: size,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {value.toFixed(1)}
        </Text>
      ) : null}
      {count !== undefined ? (
        <Text style={{ color: t.colors.textMuted, fontSize: size - 1 }}>({count})</Text>
      ) : null}
    </View>
  );
}

/**
 * Tappable 1-5 star input. The stars pop left to right and each pop is felt; the last
 * one lands harder the higher the rating, so five stars feels different from two.
 */
export function StarPicker({
  value,
  onChange,
  size = 40,
}: {
  value: number;
  onChange(next: number): void;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }} accessibilityRole="radiogroup">
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
  const spring = theme.motion.springs.bouncy;

  useEffect(() => {
    if (!filled) {
      scale.value = withSpring(1, theme.motion.springs.spatialFast);
      return;
    }
    // Stagger by position so selecting 4 stars ripples left to right. The haptic
    // pattern in starRating() uses the same 45ms step.
    scale.value = withDelay(
      n * 45,
      withSpring(1.28, spring, () => {
        scale.value = withSpring(1, spring);
      }),
    );
  }, [filled, n, scale, spring, theme.motion.springs.spatialFast]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        haptics.starRating(n);
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
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.spacing.xl,
        backgroundColor: t.colors.bg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator color={t.colors.primary} size="large" />
      {label ? <Caption style={{ marginTop: t.spacing.md }}>{label}</Caption> : null}
    </View>
  );
}

/**
 * What an empty list shows instead of nothing. Says what belongs here, and offers the
 * one action that would fill it.
 */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
  tone = 'primary',
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: Tone;
}) {
  const t = useTheme();
  const c = toneColours(t, tone);
  return (
    <Animated.View
      entering={LAYOUT_ANIMATIONS_SUPPORTED ? FadeIn.duration(t.motion.slow) : undefined}
      style={{ alignItems: 'center', paddingVertical: t.spacing.xxl, paddingHorizontal: t.spacing.lg }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 30,
          backgroundColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.lg,
          transform: [{ rotate: '-6deg' }],
        }}
      >
        <Ionicons name={icon} size={38} color={c.fg} style={{ transform: [{ rotate: '6deg' }] }} />
      </View>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? (
        <Body muted small style={{ textAlign: 'center', marginTop: t.spacing.sm, maxWidth: 300 }}>
          {message}
        </Body>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="md"
          fullWidth={false}
          style={{ marginTop: t.spacing.xl }}
        />
      ) : null}
    </Animated.View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      tone="danger"
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

const BANNER_ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  neutral: 'information-circle',
  primary: 'information-circle',
  teach: 'information-circle',
  learn: 'information-circle',
  accent: 'information-circle',
  success: 'checkmark-circle',
  warning: 'alert-circle',
  danger: 'close-circle',
};

export function Banner({ tone = 'primary', text }: { tone?: Tone; text: string }) {
  const t = useTheme();
  const c = toneColours(t, tone);

  // Errors that appear mid-flow should be felt, not just seen.
  useEffect(() => {
    if (tone === 'danger') haptics.error();
    else if (tone === 'success') haptics.success();
  }, [tone, text]);

  const spring = t.motion.springs.spatial;
  return (
    <Animated.View
      entering={
        LAYOUT_ANIMATIONS_SUPPORTED
          ? FadeInDown.springify().damping(spring.damping).stiffness(spring.stiffness)
          : undefined
      }
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: c.bg,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        marginBottom: t.spacing.lg,
      }}
      accessibilityRole="alert"
    >
      <Ionicons name={BANNER_ICONS[tone]} size={19} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: c.fg, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{text}</Text>
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
        <PressableScale onPress={onAction} haptic="tap" scaleTo={0.94} hitSlop={10}>
          <Row gap={2}>
            <Text style={{ color: t.colors.primary, fontSize: 14, lineHeight: 19, fontWeight: '700' }}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={t.colors.primary} />
          </Row>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * The large title at the top of a tab's root screen, with room for actions beside it.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: t.spacing.md,
        marginBottom: t.spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <Title numberOfLines={1}>{title}</Title>
        {subtitle ? (
          <Body muted small style={{ marginTop: 2 }}>
            {subtitle}
          </Body>
        ) : null}
      </View>
      {right ? <Row gap={t.spacing.sm}>{right}</Row> : null}
    </View>
  );
}

/**
 * A bar pinned to the bottom of a screen for its main action, so the button sits under
 * the thumb instead of at the end of a long scroll.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: t.spacing.page,
        paddingTop: t.spacing.md,
        paddingBottom: Math.max(insets.bottom, t.spacing.md),
        backgroundColor: t.colors.bgElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.colors.border,
        gap: t.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

/** A horizontal progress bar whose fill springs to its value. `value` is 0 to 1. */
export function ProgressBar({
  value,
  color,
  height = 8,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 600 });
  }, [clamped, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: t.colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color ?? t.colors.primary }, fill]}
      />
    </View>
  );
}

/** A square, softly tinted tile holding an icon. The standard lead-in for a list row. */
export function IconTile({
  icon,
  tone = 'primary',
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: number;
}) {
  const t = useTheme();
  const c = toneColours(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: c.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={c.fg} />
    </View>
  );
}

/**
 * One row of a settings-style list: icon, title, optional detail, and where it leads.
 * Group several inside a `Card` with `padding: 0`, separated by `Divider`s.
 */
export function ListRow({
  icon,
  tone = 'primary',
  title,
  subtitle,
  value,
  onPress,
  external = false,
  destructive = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  title: string;
  subtitle?: string;
  /** Short trailing text, such as a count or the current setting. */
  value?: string;
  onPress?: () => void;
  /** Leaves the app (opens a browser or mail). Changes the trailing icon. */
  external?: boolean;
  destructive?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        minHeight: 60,
        paddingVertical: 10,
      }}
    >
      {icon ? <IconTile icon={icon} tone={destructive ? 'danger' : tone} size={38} /> : null}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: destructive ? t.colors.danger : t.colors.text,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '600',
          }}
        >
          {title}
        </Text>
        {subtitle ? <Caption numberOfLines={1}>{subtitle}</Caption> : null}
      </View>
      {value ? <Caption style={{ fontSize: 14 }}>{value}</Caption> : null}
      {onPress ? (
        <Ionicons
          name={external ? 'open-outline' : 'chevron-forward'}
          size={18}
          color={t.colors.textMuted}
        />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={title}
    >
      {body}
    </PressableScale>
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

  const numeric = typeof value === 'number' ? value : null;
  // Fractional stats (hours) keep a decimal; counts stay whole.
  const decimals = numeric !== null && !Number.isInteger(numeric) ? 1 : 0;
  const counted = useCountUp(numeric ?? 0, { duration: 800, delay: index * 70, decimals });
  const spring = t.motion.springs.spatial;

  return (
    <Animated.View
      entering={
        LAYOUT_ANIMATIONS_SUPPORTED
          ? FadeInDown.delay(index * 70).springify().damping(spring.damping).stiffness(spring.stiffness)
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
      accessibilityLabel={`${label}: ${value}`}
    >
      {icon ? (
        <View style={{ marginBottom: 10 }}>
          <IconTile icon={icon} tone={tone} size={32} />
        </View>
      ) : null}

      <Text style={[t.typography.numeric, { color: t.colors.text }]}>
        {numeric === null ? value : decimals > 0 ? counted.toFixed(1) : counted}
      </Text>

      <Caption numberOfLines={2} style={{ marginTop: 2 }}>
        {label}
      </Caption>
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
          size={isTitle ? 22 : 17}
          color={t.colors.primary}
          accessibilityLabel="Verified email"
        />
      ) : null}
    </Row>
  );
}

/* ---------- Small controls ---------- */

/**
 * A password field with a show/hide eye. Hiding the password is the default, but people
 * mistype on phone keyboards, so seeing it should be one tap away (NN/g).
 */
export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'> & { error?: boolean }) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input
        {...props}
        icon="lock-closed-outline"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[{ paddingRight: 52 }, props.style]}
      />
      <Pressable
        onPress={() => {
          haptics.selection();
          setVisible((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={6}
        style={{
          position: 'absolute',
          right: 4,
          top: 0,
          bottom: 0,
          width: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.colors.textMuted} />
      </Pressable>
    </View>
  );
}

/**
 * A checkbox whose tick springs in. Toggling it is felt with the platform's own
 * toggle haptic, the same one a system switch gives.
 */
export function Checkbox({
  checked,
  onChange,
  accessibilityLabel,
  children,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  accessibilityLabel: string;
  /** Label content. Links inside it stay tappable on their own. */
  children?: ReactNode;
}) {
  const t = useTheme();
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(checked ? 1 : 0, t.motion.springs.bouncy);
  }, [checked, progress, t.motion.springs.bouncy]);

  const tick = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.5),
    transform: [{ scale: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md }}>
      <Pressable
        onPress={() => {
          haptics.toggle(!checked);
          onChange(!checked);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
        hitSlop={10}
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          borderWidth: 2,
          marginTop: 1,
          borderColor: checked ? t.colors.primary : t.colors.borderStrong,
          backgroundColor: checked ? t.colors.primary : t.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={tick}>
          <Ionicons name="checkmark" size={18} color={t.colors.onPrimary} />
        </Animated.View>
      </Pressable>
      {children ? <View style={{ flex: 1 }}>{children}</View> : null}
    </View>
  );
}

/** A tappable word or phrase in the brand colour, for secondary navigation. */
export function TextButton({
  label,
  onPress,
  size = 15,
  tone = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  size?: number;
  tone?: 'primary' | 'muted' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const colour =
    tone === 'muted' ? t.colors.textMuted : tone === 'danger' ? t.colors.danger : t.colors.primary;
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      scaleTo={0.95}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[{ minHeight: 32, justifyContent: 'center' }, style]}
    >
      <Text style={{ color: colour, fontSize: size, lineHeight: size + 6, fontWeight: '700' }}>{label}</Text>
    </PressableScale>
  );
}
