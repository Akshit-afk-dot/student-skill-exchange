import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { Primitive } from './patterns';

/**
 * Turns a primitive into the best thing each platform can do for it.
 *
 * Android has two routes, and they feel very different:
 *
 * - "system" asks the phone for its own tuned feedback (HapticFeedbackConstants). This is
 *   what Google recommends: each manufacturer tunes these for the motor in that phone, so
 *   they are crisp where raw vibration would buzz. It also obeys the phone's own
 *   touch-feedback setting, so it is silent if the owner has switched that off.
 *
 * - "vibration" drives the motor directly with a short waveform. Stronger and it ignores
 *   the touch-feedback setting, but on cheaper motors it feels coarser. Offered as an
 *   opt-in for phones where the system route cannot be felt.
 *
 * iOS has one route, the Taptic Engine's impact, selection and notification generators.
 */
export type AndroidEngine = 'system' | 'vibration';

const api = Platform.OS === 'android' ? Number(Platform.Version) : 0;
const A = Haptics.AndroidHaptics;
const Impact = Haptics.ImpactFeedbackStyle;
const Notify = Haptics.NotificationFeedbackType;

/*
 * Newer constants only exist on newer Android versions, and asking an older phone for one
 * throws. Each primitive therefore names the best constant available at this API level,
 * falling back to one of the handful that exist everywhere.
 */
const ANDROID_SYSTEM: Record<Primitive, Haptics.AndroidHaptics> = {
  tick: api >= 34 ? A.Segment_Frequent_Tick : api >= 27 ? A.Text_Handle_Move : A.Clock_Tick,
  step: api >= 34 ? A.Segment_Tick : A.Clock_Tick,
  tap: A.Keyboard_Tap,
  press: A.Virtual_Key,
  release: api >= 27 ? A.Virtual_Key_Release : A.Clock_Tick,
  click: A.Context_Click,
  thud: A.Long_Press,
  soft: api >= 30 ? A.Gesture_End : A.Keyboard_Tap,
  confirm: api >= 30 ? A.Confirm : A.Context_Click,
  warn: api >= 30 ? A.Gesture_Start : A.Long_Press,
  reject: api >= 30 ? A.Reject : A.Long_Press,
  toggleOn: api >= 34 ? A.Toggle_On : A.Context_Click,
  toggleOff: api >= 34 ? A.Toggle_Off : A.Clock_Tick,
};

type Call = () => Promise<void>;

const impact = (style: Haptics.ImpactFeedbackStyle): Call => () => Haptics.impactAsync(style);
const notify = (type: Haptics.NotificationFeedbackType): Call => () => Haptics.notificationAsync(type);
const select: Call = () => Haptics.selectionAsync();

const IOS: Record<Primitive, Call> = {
  tick: select,
  step: select,
  tap: impact(Impact.Light),
  press: impact(Impact.Medium),
  release: impact(Impact.Soft),
  click: impact(Impact.Rigid),
  thud: impact(Impact.Heavy),
  soft: impact(Impact.Soft),
  confirm: notify(Notify.Success),
  warn: notify(Notify.Warning),
  reject: notify(Notify.Error),
  toggleOn: impact(Impact.Medium),
  toggleOff: impact(Impact.Light),
};

/* The same generators on Android are plain waveforms of three strengths. */
const ANDROID_VIBRATION: Record<Primitive, Call> = {
  tick: select,
  step: select,
  tap: impact(Impact.Light),
  press: impact(Impact.Medium),
  release: impact(Impact.Light),
  click: impact(Impact.Medium),
  thud: impact(Impact.Heavy),
  soft: impact(Impact.Light),
  confirm: notify(Notify.Success),
  warn: notify(Notify.Warning),
  reject: notify(Notify.Error),
  toggleOn: impact(Impact.Medium),
  toggleOff: impact(Impact.Light),
};

export const hapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Waveform pulses last 40 to 60ms each, so they need more room between them than the
 * system's 10 to 20ms clicks before they smear together.
 */
export function minGapFor(engine: AndroidEngine): number {
  return Platform.OS === 'android' && engine === 'vibration' ? 90 : 45;
}

/**
 * Plays one primitive now. Never throws: a phone with no motor, or one that refuses a
 * particular effect, must not be able to break a screen.
 */
export function fire(primitive: Primitive, engine: AndroidEngine): void {
  if (!hapticsSupported) return;

  let call: Call;
  if (Platform.OS === 'ios') call = IOS[primitive];
  else if (engine === 'vibration') call = ANDROID_VIBRATION[primitive];
  else call = () => Haptics.performAndroidHapticsAsync(ANDROID_SYSTEM[primitive]);

  void call().catch(() => undefined);
}
