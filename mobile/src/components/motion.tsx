import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { haptics } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that scales down under the finger.
 *
 * The scale runs on the UI thread via Reanimated, so it stays smooth even while the JS
 * thread is busy parsing an API response — which is exactly when a tap is most likely.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.97,
  haptic = 'tap',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  /** Which haptic fires on press; `null` for none. */
  haptic?: keyof typeof haptics | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
}) {
  const t = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressed.value = withSpring(1, t.motion.pressSpring);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, t.motion.pressSpring);
      }}
      onPress={() => {
        if (disabled) return;
        if (haptic) haptics[haptic]();
        onPress?.();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Reanimated's layout animations (`entering` / `exiting` / `layout`) are native-only.
 * On react-native-web they do not merely skip the animation — the children never mount,
 * leaving a blank screen. Every wrapper below therefore renders a plain View on web.
 */
const LAYOUT_ANIMATIONS_SUPPORTED = Platform.OS !== 'web';

/**
 * Entrance animation for a list item.
 *
 * `index` staggers the delay so rows cascade in rather than appearing as a block. The
 * stagger is capped — past about seven items the later rows would just feel slow.
 */
export function AnimatedListItem({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const delay = Math.min(index, t.motion.maxStagger) * t.motion.stagger;

  if (!LAYOUT_ANIMATIONS_SUPPORTED) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(t.motion.normal).springify().damping(18)}
      exiting={FadeOut.duration(t.motion.fast)}
      // Makes rows slide rather than jump when one above them is removed.
      layout={LinearTransition.springify().damping(20)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Simple fade-in, for content that is not part of a list. */
export function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  if (!LAYOUT_ANIMATIONS_SUPPORTED) return <View style={style}>{children}</View>;

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(t.motion.normal)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Attention pulse — a single grow-and-settle.
 *
 * Fires when `trigger` changes, so a value that just updated draws the eye without an
 * animation that loops forever and becomes noise.
 */
export function Pulse({
  children,
  trigger,
  style,
}: {
  children: ReactNode;
  trigger: unknown;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const first = useSharedValue(true);

  useEffect(() => {
    // Skip the very first render, or everything pulses on mount.
    if (first.value) {
      first.value = false;
      return;
    }
    scale.value = withSequence(
      withTiming(1.12, { duration: t.motion.instant, easing: Easing.out(Easing.quad) }),
      withSpring(1, t.motion.spring),
    );
  }, [trigger, scale, first, t.motion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Shimmer placeholder shown while content loads.
 *
 * A skeleton that mirrors the shape of the real content reads as "nearly there", where a
 * centred spinner reads as "stuck" — the same wait feels shorter.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius: r,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // Cancel on unmount so the animation does not keep a handle on a dead view.
    return () => cancelAnimation(progress);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.45, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: r ?? t.radius.sm,
          backgroundColor: t.colors.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** A card-shaped skeleton, used while lists load. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        marginBottom: t.spacing.md,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Skeleton width={46} height={46} radius={23} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
      <View style={{ gap: 8, marginTop: t.spacing.lg }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '55%' : '100%'} height={11} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

export { Animated, FadeIn, FadeInDown, FadeOut, LinearTransition, LAYOUT_ANIMATIONS_SUPPORTED };
export type { AnimatedStyle };
