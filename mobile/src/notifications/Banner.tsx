import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, PanResponder, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { kindOf } from './kinds';
import type { NotificationData } from './open';
import { NotificationCard } from './visuals';

/**
 * The in-app banner: how a notification arrives while the app is open.
 *
 * The system's own banner is switched off in the foreground (device.ts), because Apple's
 * guidance is to present foreground news "in a way that's discoverable but not
 * distracting": this card drops in from the top on the app's own spring, in the app's own
 * type and colours, says who and what, and leaves by itself. Tap it to open what it is
 * about; swipe it up to dismiss it. A newer notification replaces it in place with a small
 * bump rather than stacking, so a burst of messages never covers the screen.
 */

export interface BannerItem {
  /** De-duplicates the socket and push copies of the same notification. */
  id: string;
  type: string;
  title: string;
  body: string;
  data: NotificationData;
}

let current: BannerItem | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Shows a banner, replacing any banner already up. */
export function showBanner(item: BannerItem): void {
  current = item;
  emit();
}

export function hideBanner(): void {
  if (!current) return;
  current = null;
  emit();
}

function useBannerItem(): BannerItem | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => current,
  );
}

/** Long enough to read two lines; longer for a screen reader, which reads it aloud. */
function visibleFor(item: BannerItem, screenReader: boolean): number {
  if (screenReader) return 10_000;
  return item.body.length > 80 ? 5_500 : 4_500;
}

const EXIT_MS = 220;

export function NotificationBanner({ onOpen }: { onOpen(item: BannerItem): void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const item = useBannerItem();

  // What is drawn. Lags `item` on the way out, so the card can leave with its content.
  const [shown, setShown] = useState<BannerItem | null>(null);
  const height = useRef(120);
  const offscreen = () => -(height.current + insets.top + 24);

  const y = useSharedValue(-400);
  const drag = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenReader = useRef(false);
  const stopHaptic = useRef<() => void>(() => undefined);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      screenReader.current = on;
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      screenReader.current = on;
    });
    return () => sub.remove();
  }, []);

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function startTimer(next: BannerItem) {
    clearTimer();
    timer.current = setTimeout(hideBanner, visibleFor(next, screenReader.current));
  }

  // Arrive, replace, or leave, following the store.
  useEffect(() => {
    if (item) {
      const replacing = shown !== null;
      setShown(item);
      stopHaptic.current();
      stopHaptic.current = haptics.arrival(kindOf(item.type).category);
      AccessibilityInfo.announceForAccessibility(`${item.title}. ${item.body}`);

      if (replacing) {
        // Already up: the new one takes its place with a small nod, not a second drop.
        scale.value = 0.96;
        scale.value = withSpring(1, t.motion.springs.spatialFast);
        y.value = withSpring(0, t.motion.springs.spatial);
        opacity.value = withTiming(1, { duration: t.motion.effects.fast });
      } else if (reduceMotion) {
        y.value = 0;
        scale.value = 1;
        opacity.value = 0;
        opacity.value = withTiming(1, { duration: t.motion.effects.normal });
      } else {
        y.value = offscreen();
        scale.value = 0.94;
        opacity.value = 1;
        y.value = withSpring(0, t.motion.springs.spatial);
        scale.value = withSpring(1, t.motion.springs.spatial);
      }
      drag.value = 0;
      startTimer(item);
      return;
    }

    if (!shown) return;
    clearTimer();
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: t.motion.effects.normal });
    } else {
      y.value = withTiming(offscreen(), { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: EXIT_MS });
    }
    const done = setTimeout(() => setShown(null), EXIT_MS + 20);
    return () => clearTimeout(done);
    // `shown` is deliberately left out: this reacts to the store, not to its own echo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  useEffect(() => () => clearTimer(), []);

  // Swipe up to dismiss. Down gives a little and springs back, so the card feels held.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => clearTimer(),
      onPanResponderMove: (_e, g) => {
        drag.value = g.dy < 0 ? g.dy : Math.min(14, g.dy * 0.25);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -28 || g.vy < -0.45) {
          haptics.settle();
          hideBanner();
        } else {
          drag.value = withSpring(0, t.motion.springs.spatialFast);
          if (current) startTimer(current);
        }
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, t.motion.springs.spatialFast);
        if (current) startTimer(current);
      },
    }),
  ).current;

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value + drag.value }, { scale: scale.value }],
  }));

  if (!shown) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 }}
    >
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => {
          height.current = e.nativeEvent.layout.height;
        }}
        style={[
          {
            marginTop: insets.top + t.spacing.sm,
            paddingHorizontal: t.spacing.md,
            alignSelf: 'center',
            width: '100%',
            // On a tablet or wide window it stays notification-sized, centred.
            maxWidth: 560 + t.spacing.md * 2,
          },
          style,
        ]}
      >
        <Pressable
          onPress={() => {
            haptics.tap();
            hideBanner();
            onOpen(shown);
          }}
          onPressIn={clearTimer}
          onPressOut={() => {
            if (current) startTimer(current);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${shown.title}. ${shown.body}`}
          accessibilityHint="Opens it. Swipe up to dismiss."
          accessibilityActions={[{ name: 'escape', label: 'Dismiss' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'escape') hideBanner();
          }}
        >
          <NotificationCard type={shown.type} title={shown.title} body={shown.body} data={shown.data} showHandle />
        </Pressable>
      </Animated.View>
    </View>
  );
}
