import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { haptics, type SimpleHaptic } from '../haptics';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that sinks slightly under the finger. For cards, rows and anything that is
 * tappable but is not a raised button (those are `Button`).
 *
 * The scale runs on the UI thread via Reanimated, so it stays smooth even while the JS
 * thread is busy parsing an API response — which is exactly when a tap is most likely.
 *
 * The haptic fires on the completed tap, not on touch-down: these live in scrolling
 * lists, and a tick every time a thumb lands to scroll would be noise.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  scaleTo = 0.97,
  haptic = 'tap',
  style,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  /** Which haptic fires on press; `null` for none. */
  haptic?: SimpleHaptic | null;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'tab' | 'radio' | 'checkbox' | 'switch';
  accessibilityState?: { selected?: boolean; checked?: boolean };
}) {
  const t = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressed.value = withSpring(1, t.motion.pressSpring);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, t.motion.springs.spatialFast);
      }}
      onPress={() => {
        if (disabled) return;
        if (haptic) haptics[haptic]();
        onPress?.();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
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
 * stagger is capped — past about six items the later rows would just feel slow.
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

  const spring = t.motion.springs.spatial;
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(spring.damping).stiffness(spring.stiffness)}
      exiting={FadeOut.duration(t.motion.fast)}
      // Makes rows slide rather than jump when one above them is removed.
      layout={LinearTransition.springify().damping(spring.damping).stiffness(spring.stiffness)}
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
    <Animated.View entering={FadeIn.delay(delay).duration(t.motion.slow)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Springs in from small, with a little overshoot. For badges, ticks and celebration pieces. */
export function PopIn({
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

  const spring = t.motion.springs.bouncy;
  return (
    <Animated.View
      entering={ZoomIn.delay(delay).springify().damping(spring.damping).stiffness(spring.stiffness)}
      style={style}
    >
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
      withSpring(1, t.motion.springs.spatialFast),
    );
  }, [trigger, scale, first, t.motion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Placeholder shown while content loads, with a highlight that sweeps across it.
 *
 * A skeleton that mirrors the shape of the real content reads as "nearly there", where a
 * centred spinner reads as "stuck" — the same wait feels shorter. With Reduce Motion on,
 * the sweep is replaced by a still block.
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
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    // Cancel on unmount so the animation does not keep a handle on a dead view.
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-measured, measured]) }],
  }));

  return (
    <View
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={[
        {
          width,
          height,
          borderRadius: r ?? t.radius.sm,
          backgroundColor: t.colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {!reduceMotion && measured > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
          <LinearGradient
            colors={[t.colors.skeleton, t.colors.skeletonHighlight, t.colors.skeleton]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
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
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Skeleton width={52} height={52} radius={26} />
        <View style={{ flex: 1, gap: 9 }}>
          <Skeleton width="58%" height={15} />
          <Skeleton width="38%" height={11} />
        </View>
        <Skeleton width={56} height={56} radius={28} />
      </View>
      <View style={{ gap: 9, marginTop: t.spacing.lg }}>
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

/** A row-shaped skeleton: avatar, two lines. For chats, connections and notifications. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  const t = useTheme();
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md }}
        >
          <Skeleton width={52} height={52} radius={26} />
          <View style={{ flex: 1, gap: 9 }}>
            <Skeleton width={i % 2 === 0 ? '46%' : '62%'} height={14} />
            <Skeleton width={i % 2 === 0 ? '78%' : '54%'} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export { Animated, FadeIn, FadeInDown, FadeOut, LinearTransition, LAYOUT_ANIMATIONS_SUPPORTED };
export type { AnimatedStyle };
