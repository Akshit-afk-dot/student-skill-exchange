import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';
import { Avatar } from './ui';

/**
 * The moment two students connect.
 *
 * Choreographed to the `connection` haptic pattern, beat for beat:
 *   0, 130, 260 ms  three light taps as the avatars are drawn together, speeding up
 *   420 ms          they meet: a heavy thud, and the burst goes off
 *   640 ms          the title lands with the confirmation pattern
 *
 * The approach accelerates (ease-in), like two magnets closing the last gap, so the
 * thud arrives at the fastest point of the motion, where a real impact would be.
 */
const CONTACT_MS = 420;
const TITLE_MS = 640;
const AVATAR = 96;
const START = 150;
// Resting just apart; the overshoot on arrival pushes them briefly into each other.
const REST = AVATAR / 2 + 2;

const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  // Deterministic jitter, so the burst looks scattered but the same every time.
  const jitter = ((i * 37) % 11) / 11 - 0.5;
  return {
    angle: (i / 16) * Math.PI * 2 + jitter * 0.5,
    distance: 96 + ((i * 53) % 60),
    size: 6 + ((i * 29) % 6),
    round: i % 3 !== 0,
  };
});

function Particle({
  burst,
  angle,
  distance,
  size,
  colour,
  round,
}: {
  burst: SharedValue<number>;
  angle: number;
  distance: number;
  size: number;
  colour: string;
  round: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const p = burst.value;
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        // A little gravity, so the pieces arc rather than fly in straight lines.
        { translateY: Math.sin(angle) * distance * p + p * p * 36 },
        { rotate: `${angle * 2 + p * 3}rad` },
        { scale: 1 - p * 0.35 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: round ? size : size * 1.8,
          borderRadius: round ? size / 2 : 2,
          backgroundColor: colour,
        },
        style,
      ]}
    />
  );
}

export function ConnectionCelebration({
  visible,
  me,
  partner,
  skill,
  onMessage,
  onClose,
}: {
  visible: boolean;
  me: { name: string; profileImage?: string };
  partner: { name: string; profileImage?: string };
  skill?: string;
  onMessage(): void;
  onClose(): void;
}) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();

  const approach = useSharedValue(0);
  const burst = useSharedValue(0);
  const ring = useSharedValue(0);
  const title = useSharedValue(0);
  const actions = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      approach.value = 0;
      burst.value = 0;
      ring.value = 0;
      title.value = 0;
      actions.value = 0;
      return;
    }

    if (reduceMotion) {
      approach.value = 1;
      title.value = 1;
      actions.value = 1;
      haptics.success();
      return;
    }

    const cancel = haptics.connection();
    approach.value = withSequence(
      withTiming(1.06, { duration: CONTACT_MS, easing: Easing.in(Easing.cubic) }),
      withSpring(1, t.motion.springs.bouncy),
    );
    burst.value = withDelay(CONTACT_MS, withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
    ring.value = withDelay(CONTACT_MS, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    title.value = withDelay(TITLE_MS, withSpring(1, t.motion.springs.bouncy));
    actions.value = withDelay(TITLE_MS + 180, withTiming(1, { duration: t.motion.normal }));
    return cancel;
  }, [visible, reduceMotion, approach, burst, ring, title, actions, t.motion]);

  const left = useAnimatedStyle(() => ({
    transform: [{ translateX: -START + (START - REST) * approach.value }, { rotate: `${(1 - approach.value) * -12}deg` }],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [{ translateX: START - (START - REST) * approach.value }, { rotate: `${(1 - approach.value) * 12}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.55 * (1 - ring.value),
    transform: [{ scale: 0.5 + ring.value * 1.9 }],
  }));
  const badge = useAnimatedStyle(() => ({
    opacity: title.value > 0 ? 1 : 0,
    transform: [{ scale: title.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, title.value * 1.4),
    transform: [{ translateY: (1 - title.value) * 16 }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actions.value,
    transform: [{ translateY: (1 - actions.value) * 12 }],
  }));

  const colours = [t.colors.primary, t.colors.learnVivid, t.colors.success, t.colors.star];
  const firstName = partner.name.split(' ')[0] ?? partner.name;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.bg }]} />
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl }}
        accessibilityViewIsModal
      >
        <View style={{ height: 220, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 150,
                height: 150,
                borderRadius: 75,
                borderWidth: 10,
                borderColor: t.colors.success,
              },
              ringStyle,
            ]}
          />
          {PARTICLES.map((p, i) => (
            <Particle key={i} burst={burst} colour={colours[i % colours.length] ?? t.colors.primary} {...p} />
          ))}
          <Animated.View style={[{ position: 'absolute' }, left]}>
            <Avatar name={me.name} uri={me.profileImage} size={AVATAR} ring={t.colors.primary} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute' }, right]}>
            <Avatar name={partner.name} uri={partner.profileImage} size={AVATAR} ring={t.colors.learnVivid} />
          </Animated.View>
          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 34,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: t.colors.success,
                borderWidth: 4,
                borderColor: t.colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
              },
              badge,
            ]}
          >
            <Ionicons name="checkmark" size={22} color={t.colors.onSuccess} />
          </Animated.View>
        </View>

        <Animated.View style={[{ alignItems: 'center', marginTop: t.spacing.lg }, titleStyle]}>
          <Text
            accessibilityRole="header"
            style={[t.typography.display, { color: t.colors.text, textAlign: 'center' }]}
          >
            You're connected!
          </Text>
          <Text
            style={[
              t.typography.body,
              { color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing.sm, maxWidth: 300 },
            ]}
          >
            {skill
              ? `You and ${firstName} can now plan your first ${skill} session.`
              : `You and ${firstName} can now chat and plan your first session.`}
          </Text>
        </Animated.View>

        <Animated.View style={[{ alignSelf: 'stretch', gap: t.spacing.md, marginTop: t.spacing.xxl }, actionsStyle]}>
          <Button label={`Say hello to ${firstName}`} icon="chatbubble" onPress={onMessage} />
          <Button label="Not now" variant="ghost" onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}
