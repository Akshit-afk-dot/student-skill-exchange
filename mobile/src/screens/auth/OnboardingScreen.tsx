import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '../../components/Text';
import { Body, Button, Display, Screen } from '../../components/ui';
import { useTheme } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

/**
 * Skills drifting around the exchange mark. Indigo ones are taught, teal ones learned:
 * the same two colours the rest of the app uses for exactly that, introduced here.
 */
const FLOATING: ReadonlyArray<{
  label: string;
  kind: 'teach' | 'learn';
  /** Position as a fraction of the stage, measured to the chip's centre. */
  x: number;
  y: number;
}> = [
  { label: 'Python', kind: 'teach', x: 0.2, y: 0.14 },
  { label: 'Guitar', kind: 'learn', x: 0.79, y: 0.2 },
  { label: 'Figma', kind: 'learn', x: 0.14, y: 0.5 },
  { label: 'Public speaking', kind: 'teach', x: 0.76, y: 0.77 },
  { label: 'Spanish', kind: 'teach', x: 0.22, y: 0.84 },
  { label: 'Photography', kind: 'learn', x: 0.68, y: 0.97 },
];

const STAGE_HEIGHT = 330;

/** One skill chip: pops in, then bobs gently for as long as the screen is open. */
function FloatingSkill({
  label,
  kind,
  x,
  y,
  index,
}: {
  label: string;
  kind: 'teach' | 'learn';
  x: number;
  y: number;
  index: number;
}) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const appear = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(250 + index * 90, withSpring(1, t.motion.springs.bouncy));
    if (reduceMotion) return;
    // Different periods per chip, so they never move in step and look mechanical.
    bob.value = withDelay(
      index * 260,
      withRepeat(
        withTiming(1, { duration: 2400 + index * 280, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [appear, bob, index, reduceMotion, t.motion.springs.bouncy]);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (bob.value - 0.5) * 12 }, { scale: 0.6 + appear.value * 0.4 }],
  }));

  // Teach and learn differ by icon as well as colour (school and book, as everywhere else),
  // so the pairing reads for people who cannot tell the two hues apart.
  const tint = kind === 'teach' ? t.colors.primary : t.colors.tertiary;
  const glyph = kind === 'teach' ? 'school' : 'book';

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          // Half the chip's rough size, so the anchor above is its centre.
          marginLeft: -52,
          marginTop: -19,
          width: 104,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.pill,
            paddingHorizontal: 13,
            height: 38,
            borderWidth: 1,
            borderColor: t.colors.border,
          },
          t.elevation(2),
        ]}
      >
        <Ionicons name={glyph} size={14} color={tint} />
        <Text
          numberOfLines={1}
          style={{ color: t.colors.textPrimary, fontSize: 13.5, lineHeight: 18, fontWeight: '700' }}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

/** The centrepiece: the app's two-arrow mark, springing in over two soft halos. */
function ExchangeMark() {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const appear = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    appear.value = withSpring(1, t.motion.springs.bouncy);
    if (reduceMotion) return;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [appear, breathe, reduceMotion, t.motion.springs.bouncy]);

  const mark = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + appear.value * 0.6 }] }));
  const outer = useAnimatedStyle(() => ({
    opacity: appear.value * 0.5,
    transform: [{ scale: 1 + breathe.value * 0.06 }],
  }));
  const inner = useAnimatedStyle(() => ({
    opacity: appear.value * 0.8,
    transform: [{ scale: 1 + (1 - breathe.value) * 0.05 }],
  }));

  const halo = {
    position: 'absolute' as const,
    backgroundColor: t.colors.primaryContainer,
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[halo, { width: 250, height: 250, borderRadius: 125 }, outer]} />
      <Animated.View style={[halo, { width: 186, height: 186, borderRadius: 93 }, inner]} />
      <Animated.View style={[t.elevation(3), { borderRadius: 40 }, mark]}>
        <View
          style={{
            width: 124,
            height: 124,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.primary,
          }}
        >
          <Ionicons name="swap-horizontal" size={62} color={t.colors.onPrimary} />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * The first screen a new student sees.
 *
 * One screen, not a swipe-through tour: the idea fits in a headline, and every extra
 * slide is a tap between someone and the app. The picture does the explaining.
 */
export function OnboardingScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View
        style={{ flex: 1, justifyContent: 'center' }}
        // Decorative: a screen reader should go straight to the headline.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={{ height: STAGE_HEIGHT, marginHorizontal: t.spacing.lg, justifyContent: 'center' }}>
          <ExchangeMark />
          {FLOATING.map((skill, index) => (
            <FloatingSkill key={skill.label} index={index} {...skill} />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: t.spacing.page, paddingBottom: t.spacing.xl }}>
        <Display style={{ textAlign: 'center' }}>Trade skills,{'\n'}not money</Display>
        <Body muted style={{ textAlign: 'center', marginTop: t.spacing.md, marginBottom: t.spacing.xl }}>
          Teach what you know. Learn what you don't. Students helping students, with no fees.
        </Body>

        <View style={{ gap: t.spacing.md }}>
          <Button label="Get started" onPress={() => navigation.navigate('Register')} />
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    </Screen>
  );
}
