import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Text } from '../components/ui';
import { haptics } from '../haptics';
import { useTheme } from '../theme';
import { prefs } from '../utils/prefs';
import { pushSupported, refreshPermission, registerForPush, requestPushPermission } from './device';
import { NotificationCard } from './visuals';

/**
 * Asking for notification permission, at a moment that explains itself.
 *
 * Never on first launch: Nielsen Norman Group found people refuse a prompt from an app
 * that has not yet given them anything, and both Apple and Google say to ask in context.
 * So the app asks right after something that will have a reply worth hearing: a request
 * sent, a connection made, a session booked. The sheet shows two notifications exactly as
 * they would arrive, with the real person's name, says what kinds will come (and that ads
 * never will), and only then hands over to the system prompt.
 *
 * "Not now" is respected: no more than three asks, a week apart, and never again once the
 * system prompt has been refused for good. Settings → Notifications is always there.
 */

export interface PromptContext {
  /** What just happened, which decides the pitch. */
  reason: 'request' | 'connection' | 'session' | 'general';
  /** The other student, so the preview shows the person they will actually hear from. */
  name?: string;
  skill?: string;
}

const KEY = 'sse.push.prompt';
const MAX_ASKS = 3;
const GAP_MS = 7 * 24 * 60 * 60_000;

let current: PromptContext | null = null;
const listeners = new Set<() => void>();

function set(next: PromptContext | null): void {
  current = next;
  for (const listener of listeners) listener();
}

async function history(): Promise<{ asks: number; lastAt: number }> {
  try {
    const raw = await prefs.get(KEY);
    const parsed = raw ? (JSON.parse(raw) as { asks?: number; lastAt?: number }) : {};
    return { asks: parsed.asks ?? 0, lastAt: parsed.lastAt ?? 0 };
  } catch {
    return { asks: 0, lastAt: 0 };
  }
}

async function recordAsk(): Promise<void> {
  const { asks } = await history();
  await prefs.set(KEY, JSON.stringify({ asks: asks + 1, lastAt: Date.now() }));
}

/**
 * Offers notifications after a moment that makes them worth having. Does nothing when
 * they are already on, refused for good, or were turned down recently. The short delay
 * lets the moment's own success land first.
 */
export async function askForNotifications(context: PromptContext, delayMs = 700): Promise<void> {
  if (!pushSupported || current) return;
  const permission = await refreshPermission();
  if (permission === 'granted') {
    void registerForPush();
    return;
  }
  if (permission === 'blocked' || permission === 'unsupported') return;
  const { asks, lastAt } = await history();
  if (asks >= MAX_ASKS || Date.now() - lastAt < GAP_MS) return;
  setTimeout(() => set(context), delayMs);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The pitch for each moment: a title, and the two notifications in the preview. */
function pitch({ reason, name = 'Priya Sharma', skill = 'Guitar' }: PromptContext) {
  const first = firstName(name);
  const person = { actorName: name };
  const message = (body: string) => ({ type: 'MESSAGE_RECEIVED', title: name, body, data: person });
  const reminder = {
    type: 'SESSION_REMINDER',
    title: `${skill} starts in 25 minutes`,
    body: `With ${name} at 5:00 pm · Online`,
    data: {},
  };

  switch (reason) {
    case 'request':
      return {
        title: `Know when ${first} replies`,
        cards: [
          {
            type: 'REQUEST_ACCEPTED',
            title: name,
            body: `Accepted your request to learn ${skill}. You’re connected.`,
            data: person,
          },
          message('Hi! When are you free this week?'),
        ],
      };
    case 'connection':
      return {
        title: `Never miss a message from ${first}`,
        cards: [message('Hi! When works for you this week?'), reminder],
      };
    case 'session':
      return {
        title: 'Get a reminder before it starts',
        cards: [reminder, message('See you soon!')],
      };
    default:
      return {
        title: 'Stay in the loop',
        cards: [
          { type: 'REQUEST_RECEIVED', title: name, body: `Wants to learn ${skill} from you.`, data: person },
          message('Hi! When are you free this week?'),
        ],
      };
  }
}

export function NotificationPrompt() {
  const context = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => current,
  );
  const [visible, setVisible] = useState(false);
  const [shownContext, setShownContext] = useState<PromptContext | null>(null);
  const [busy, setBusy] = useState(false);

  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const sheet = useSharedValue(600);
  const scrim = useSharedValue(0);
  const back = useSharedValue(0);
  const front = useSharedValue(0);

  useEffect(() => {
    if (!context) return;
    setShownContext(context);
    setVisible(true);
    haptics.settle();
    if (reduceMotion) {
      sheet.value = 0;
      back.value = 1;
      front.value = 1;
      scrim.value = withTiming(1, { duration: t.motion.effects.normal });
      return;
    }
    sheet.value = 600;
    back.value = 0;
    front.value = 0;
    scrim.value = withTiming(1, { duration: t.motion.effects.slow });
    sheet.value = withSpring(0, t.motion.springs.spatial);
    // The two previews arrive one after the other, the way notifications do.
    back.value = withDelay(180, withSpring(1, t.motion.springs.spatial));
    front.value = withDelay(300, withSpring(1, t.motion.springs.spatial));
    const stop = haptics.cascade(2, 120);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  function close(after?: () => void) {
    scrim.value = withTiming(0, { duration: t.motion.effects.normal });
    sheet.value = reduceMotion ? 0 : withTiming(600, { duration: 240, easing: Easing.in(Easing.cubic) });
    setTimeout(() => {
      setVisible(false);
      set(null);
      after?.();
    }, 250);
  }

  async function turnOn() {
    setBusy(true);
    await recordAsk();
    const permission = await requestPushPermission();
    setBusy(false);
    if (permission === 'granted') haptics.success();
    close();
  }

  function notNow() {
    void recordAsk();
    close();
  }

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value * 0.4 }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? scrim.value : 1,
    transform: [{ translateY: sheet.value }],
  }));
  // The second notification waits behind the first, its top edge showing: a stack.
  const backStyle = useAnimatedStyle(() => ({
    opacity: back.value * 0.7,
    transform: [{ translateY: -20 + (1 - back.value) * 16 }, { scale: 0.9 }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: front.value,
    transform: [{ translateY: (1 - front.value) * 22 }],
  }));

  if (!shownContext) return null;
  const { title, cards } = pitch(shownContext);
  const [first, second] = cards;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={notNow}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.shadow }, scrimStyle]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={notNow}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              backgroundColor: t.colors.surface,
              borderTopLeftRadius: t.radius.xl,
              borderTopRightRadius: t.radius.xl,
              paddingHorizontal: t.spacing.page,
              paddingTop: t.spacing.sm,
              paddingBottom: insets.bottom + t.spacing.lg,
              width: '100%',
              maxWidth: 560,
              alignSelf: 'center',
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.colors.border,
              marginBottom: t.spacing.lg,
            }}
          />

          {/* The preview: what would have arrived, on a soft brand stage. */}
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={{
              backgroundColor: t.colors.primaryContainer,
              borderRadius: t.radius.lg,
              paddingHorizontal: t.spacing.lg,
              paddingTop: t.spacing.xl + 8,
              paddingBottom: t.spacing.xl - 4,
              marginBottom: t.spacing.xl,
              overflow: 'hidden',
            }}
          >
            {second ? (
              <Animated.View style={[{ position: 'absolute', left: t.spacing.lg, right: t.spacing.lg, top: t.spacing.xl + 8 }, backStyle]}>
                <NotificationCard {...second} />
              </Animated.View>
            ) : null}
            {first ? (
              <Animated.View style={frontStyle}>
                <NotificationCard {...first} />
              </Animated.View>
            ) : null}
          </View>

          <Text
            accessibilityRole="header"
            style={[t.typography.title, { fontSize: 24, lineHeight: 30, color: t.colors.textPrimary, marginBottom: t.spacing.sm }]}
          >
            {title}
          </Text>
          <Body muted style={{ marginBottom: t.spacing.xl }}>
            Messages, requests and session reminders, as they happen. Never ads. You can choose which
            ones in Settings.
          </Body>

          <Button label="Turn on notifications" icon="notifications" onPress={() => void turnOn()} loading={busy} />
          <View style={{ height: t.spacing.sm }} />
          <Button label="Not now" variant="ghost" onPress={notNow} haptic={null} disabled={busy} />
        </Animated.View>
      </View>
    </Modal>
  );
}
