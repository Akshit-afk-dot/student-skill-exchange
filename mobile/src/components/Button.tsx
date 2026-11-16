import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics, type SimpleHaptic } from '../haptics';
import { useTheme, type Theme } from '../theme';
import { PressableScale } from './motion';
import { Text } from './Text';

export type ButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'secondary'
  | 'tonal'
  | 'ghost'
  /** White, for use on the brand gradient. */
  | 'inverse';
export type ButtonSize = 'lg' | 'md' | 'sm';

const SIZES: Record<ButtonSize, { height: number; padX: number; font: number; icon: number; radius: number }> = {
  lg: { height: 52, padX: 22, font: 16, icon: 19, radius: 16 },
  md: { height: 44, padX: 18, font: 15, icon: 17, radius: 14 },
  sm: { height: 36, padX: 14, font: 13.5, icon: 15, radius: 12 },
};

interface Skin {
  face: string;
  edge: string;
  label: string;
  border?: string;
}

function skinFor(t: Theme, variant: ButtonVariant): Skin {
  switch (variant) {
    case 'primary':
      return { face: t.colors.primary, edge: t.colors.primaryEdge, label: t.colors.onPrimary };
    case 'success':
      return { face: t.colors.success, edge: t.colors.successEdge, label: t.colors.onSuccess };
    case 'danger':
      return { face: t.colors.danger, edge: t.colors.dangerEdge, label: t.colors.onDanger };
    case 'secondary':
      return {
        face: t.colors.surface,
        edge: t.colors.neutralEdge,
        label: t.colors.text,
        border: t.colors.neutralEdge,
      };
    case 'tonal':
      return { face: t.colors.primarySoft, edge: t.colors.primarySoft, label: t.colors.primary };
    case 'inverse':
      // Sits on the hero gradient in both themes, so its colours do not follow the theme.
      return { face: '#FFFFFF', edge: 'rgba(22, 12, 80, 0.38)', label: '#4334C8' };
    default:
      return { face: 'transparent', edge: 'transparent', label: t.colors.text, border: t.colors.borderStrong };
  }
}

/**
 * The app's button.
 *
 * Primary, success, danger and secondary buttons are raised: the face sits a few points
 * above a darker lip, and pressing pushes the face down onto it. That travel is the
 * design's signature, and it is matched by touch: a key-down haptic as the face goes
 * down and a softer key-up as it returns, like a real key.
 *
 * Tonal and ghost buttons are flat, for actions that should not compete with the main
 * one on a screen. Use at most one raised primary button per view.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  iconRight,
  fullWidth = true,
  haptic,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  /** Replaces the key-up haptic on release; `null` silences the button entirely. */
  haptic?: SimpleHaptic | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const dims = SIZES[size];
  const raised = variant !== 'ghost' && variant !== 'tonal';
  const lip = raised ? (size === 'lg' ? t.depth.button : t.depth.small) : 0;
  const inactive = disabled || loading;

  const skin: Skin = disabled
    ? { face: t.colors.surfaceAlt, edge: t.colors.border, label: t.colors.textMuted }
    : skinFor(t, variant);

  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * lip }],
  }));

  const content = loading ? (
    <ActivityIndicator color={skin.label} size="small" />
  ) : (
    <>
      {icon ? <Ionicons name={icon} size={dims.icon} color={skin.label} /> : null}
      <Text
        numberOfLines={1}
        style={[t.typography.button, { color: skin.label, fontSize: dims.font, flexShrink: 1 }]}
      >
        {label}
      </Text>
      {iconRight ? <Ionicons name={iconRight} size={dims.icon} color={skin.label} /> : null}
    </>
  );

  const face: ViewStyle = {
    minHeight: dims.height,
    paddingHorizontal: dims.padX,
    borderRadius: dims.radius,
    backgroundColor: skin.face,
    borderWidth: skin.border ? 1.5 : 0,
    borderColor: skin.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel ?? label,
    accessibilityState: { disabled: inactive, busy: loading },
  };

  if (!raised) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={inactive}
        haptic={haptic === undefined ? 'tap' : haptic}
        accessibilityLabel={a11y.accessibilityLabel}
        hitSlop={size === 'sm' ? 6 : undefined}
        style={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }, style]}
      >
        <View style={face}>{content}</View>
      </PressableScale>
    );
  }

  return (
    <Pressable
      {...a11y}
      disabled={inactive}
      hitSlop={size === 'sm' ? 6 : undefined}
      // Long enough that starting a scroll on top of a button does not register as a
      // press (and fire its haptic), short enough that a real tap still feels instant.
      unstable_pressDelay={70}
      onPressIn={() => {
        pressed.value = withSpring(1, t.motion.pressSpring);
        if (haptic !== null) haptics.keyDown();
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, t.motion.springs.spatialFast);
      }}
      onPress={() => {
        if (haptic === undefined) haptics.keyUp();
        else if (haptic !== null) haptics[haptic]();
        onPress();
      }}
      style={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start', paddingBottom: lip }, style]}
    >
      {/* The lip: the same shape as the face, sitting `lip` points lower. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { top: lip, borderRadius: dims.radius, backgroundColor: skin.edge },
        ]}
      />
      <Animated.View style={[face, faceStyle]}>{content}</Animated.View>
    </Pressable>
  );
}

/**
 * A round icon-only button, for toolbar actions such as notifications or filters.
 * 44 points across, so it meets the minimum touch target without relying on hit slop.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  badge = false,
  tone = 'surface',
  size = 44,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Required: an icon alone says nothing to a screen reader. */
  accessibilityLabel: string;
  /** Shows a small dot, for "there is something new here". */
  badge?: boolean;
  tone?: 'surface' | 'primary' | 'plain';
  size?: number;
}) {
  const t = useTheme();
  const bg =
    tone === 'primary' ? t.colors.primarySoft : tone === 'plain' ? 'transparent' : t.colors.surface;
  const fg = tone === 'primary' ? t.colors.primary : t.colors.text;

  return (
    <PressableScale onPress={onPress} scaleTo={0.9} accessibilityLabel={accessibilityLabel}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: tone === 'surface' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.colors.border,
        }}
      >
        <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: size * 0.2,
              right: size * 0.22,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: t.colors.danger,
              borderWidth: 2,
              borderColor: bg === 'transparent' ? t.colors.bg : bg,
            }}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}
