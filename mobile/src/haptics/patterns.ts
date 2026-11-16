/**
 * Haptic patterns, as data.
 *
 * A pattern is a list of primitives with times. Building them as plain data keeps this
 * file free of any device code, so the timing maths can be checked without a phone, and
 * the same pattern plays on iOS and Android through whatever each platform offers.
 *
 * The rules these follow (Apple's and Google's guidance agree on all of them):
 * - One meaning per pattern. Success never feels like failure.
 * - Strength follows importance. Things that happen often are barely there.
 * - Patterns that accompany motion are timed from the same curve as the motion.
 * - Short. Nothing here runs longer than the animation it belongs to.
 */

/**
 * The vocabulary, lightest to heaviest, then the ones with a fixed meaning.
 *
 * - tick:    the faintest detent. Safe to repeat many times a second.
 * - step:    one notch of a selector. Changing a tab, a chip, a star.
 * - tap:     a light touch. Opening a card or a row.
 * - press:   a key going down. The start of pressing a raised button.
 * - release: the same key coming back up. Softer than the press.
 * - click:   crisp and mechanical. Something snapped into place.
 * - thud:    heavy. Weighty or destructive actions, and impacts in celebrations.
 * - soft:    rounded and dull. Something settled.
 * - confirm / warn / reject: outcomes. Reserved for results, never decoration.
 * - toggleOn / toggleOff: a switch changing state.
 */
export type Primitive =
  | 'tick'
  | 'step'
  | 'tap'
  | 'press'
  | 'release'
  | 'click'
  | 'thud'
  | 'soft'
  | 'confirm'
  | 'warn'
  | 'reject'
  | 'toggleOn'
  | 'toggleOff';

export interface HapticEvent {
  /** Milliseconds from the start of the pattern. */
  at: number;
  p: Primitive;
  /**
   * True for texture that enriches a pattern but is not the message itself. Dropped at
   * the "Subtle" setting, and the first thing dropped when events crowd together.
   */
  detail?: boolean;
}

export type HapticPattern = HapticEvent[];

/** Two primitives closer together than this blur into one buzz on most phone motors. */
export const MIN_GAP_MS = 45;

const one = (p: Primitive, detail = false): HapticPattern => [{ at: 0, p, detail }];

/** Drops detail events that land too close to the event before them. */
function spaced(events: HapticEvent[], minGap = MIN_GAP_MS): HapticPattern {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const out: HapticEvent[] = [];
  for (const event of sorted) {
    const previous = out[out.length - 1];
    if (previous && event.at - previous.at < minGap) {
      // Keep whichever carries the message; between two details, keep the earlier.
      if (event.detail || !previous.detail) continue;
      out.pop();
    }
    out.push(event);
  }
  return out;
}

/** Time at which a cubic ease-out (the curve the counters use) reaches `fraction`. */
function easeOutCubicTime(fraction: number): number {
  return 1 - Math.cbrt(1 - Math.min(1, Math.max(0, fraction)));
}

/**
 * The match score filling up.
 *
 * The ring and its number ease out: fast at first, slowing as they near the score. The
 * ticks are placed on that same curve, one every few points, so they bunch together
 * early and spread apart as the ring slows, the way a spun wheel clicks slower before it
 * stops. They also grow firmer near the end, then the score lands with a weight that
 * depends on how good it is. A two-way match lands twice, like a heartbeat.
 */
export function scoreReveal(score: number, durationMs: number, twoWay = false): HapticPattern {
  const target = Math.max(0, Math.min(100, Math.round(score)));
  if (target < 5) return one('soft');

  const pointsPerTick = target >= 60 ? 6 : 5;
  const events: HapticEvent[] = [];

  // Every candidate sits where the number crosses a multiple of `pointsPerTick`. One is
  // kept only if the gap before it is at least as long as the gap before the last one
  // kept, so the rhythm can only ever slow down. Simply dropping crowded ticks is not
  // enough: that leaves an uneven beat (long, short, long) where the curve changes pace.
  let lastAt = -Infinity;
  let lastGap = MIN_GAP_MS;
  for (let value = pointsPerTick; value < target; value += pointsPerTick) {
    const fraction = value / target;
    const at = Math.round(easeOutCubicTime(fraction) * durationMs);
    if (at - lastAt < lastGap) continue;
    if (durationMs - at < MIN_GAP_MS) break;

    if (lastAt !== -Infinity) lastGap = at - lastAt;
    lastAt = at;
    events.push({
      at,
      // The last third of the climb is felt more clearly than the start.
      p: fraction > 0.66 ? 'step' : 'tick',
      detail: true,
    });
  }

  const landing: Primitive = target >= 80 ? 'confirm' : target >= 55 ? 'click' : 'tap';
  if (twoWay) {
    events.push({ at: durationMs, p: 'thud' });
    events.push({ at: durationMs + 150, p: landing === 'tap' ? 'click' : landing });
  } else {
    events.push({ at: durationMs, p: landing });
  }

  return events;
}

/**
 * Choosing a star rating. The stars pop left to right, 45ms apart, and each pop has a
 * tick; the last one is as strong as the rating is high, so five stars ends on a thud
 * and one star on a tap.
 */
export function starRating(stars: number): HapticPattern {
  const n = Math.max(1, Math.min(5, Math.round(stars)));
  const final: Primitive[] = ['tap', 'tap', 'press', 'click', 'thud'];
  const events: HapticEvent[] = [];
  for (let i = 1; i < n; i += 1) events.push({ at: i * 45, p: 'tick', detail: true });
  events.push({ at: n * 45, p: final[n - 1] ?? 'tap' });
  return spaced(events);
}

/**
 * Two students connect: the app's biggest moment.
 *
 * Timed against the celebration animation: the two avatars travel toward each other
 * (two approaching taps), meet (a thud), and the badge between them springs in (confirm).
 */
export function connection(): HapticPattern {
  return [
    { at: 0, p: 'tap', detail: true },
    { at: 130, p: 'tap', detail: true },
    { at: 260, p: 'press', detail: true },
    { at: 420, p: 'thud' },
    { at: 640, p: 'confirm' },
  ];
}

/** A badge or milestone earned: a quick rising run, then a flourish. */
export function achievement(): HapticPattern {
  return [
    { at: 0, p: 'tick', detail: true },
    { at: 70, p: 'step', detail: true },
    { at: 140, p: 'tap', detail: true },
    { at: 230, p: 'click' },
    { at: 420, p: 'confirm' },
  ];
}

/** Something was sent and accepted by the server: a request, a booking, a review. */
export function sent(): HapticPattern {
  return [
    { at: 0, p: 'click', detail: true },
    { at: 140, p: 'confirm' },
  ];
}

/** A chat message leaving. Frequent, so it is a single soft pop. */
export function messageSent(): HapticPattern {
  return one('release', true);
}

/** A chat message arriving while the conversation is open: two light knocks. */
export function messageReceived(): HapticPattern {
  return [
    { at: 0, p: 'tick', detail: true },
    { at: 80, p: 'tap', detail: true },
  ];
}

/**
 * Holding a control that needs a deliberate long press. Ticks come faster and firmer as
 * the hold nears completion, then it commits with a thud. Stop the pattern if the finger
 * lifts early.
 */
export function holdToConfirm(durationMs: number): HapticPattern {
  const events: HapticEvent[] = [];
  const steps = Math.max(3, Math.min(9, Math.round(durationMs / 110)));
  for (let i = 1; i < steps; i += 1) {
    // Quadratic spacing: sparse at first, dense at the end.
    const fraction = 1 - Math.pow(1 - i / steps, 2);
    events.push({
      at: Math.round(fraction * durationMs),
      p: i / steps > 0.6 ? 'step' : 'tick',
      detail: true,
    });
  }
  events.push({ at: durationMs, p: 'thud' });
  return spaced(events);
}

/** A run of `count` items appearing one after another, such as onboarding chips. */
export function cascade(count: number, intervalMs: number): HapticPattern {
  const n = Math.max(1, Math.min(8, count));
  return spaced(
    Array.from({ length: n }, (_, i) => ({ at: i * intervalMs, p: 'tick' as const, detail: true })),
    Math.min(MIN_GAP_MS, intervalMs),
  );
}

/** Single-primitive patterns, named for what they mean rather than how they feel. */
export const simple = {
  /** A tab, chip, segment or picker value changed. */
  selection: (): HapticPattern => one('step'),
  /** A card or row was opened. */
  tap: (): HapticPattern => one('tap'),
  /** A raised button going down. */
  keyDown: (): HapticPattern => one('press'),
  /** The same button coming back up. */
  keyUp: (): HapticPattern => one('release', true),
  /** A committing action without a raised button of its own. */
  press: (): HapticPattern => one('click'),
  success: (): HapticPattern => one('confirm'),
  warn: (): HapticPattern => one('warn'),
  error: (): HapticPattern => one('reject'),
  /** Declining, deleting, cancelling: heavier than a tap, and never celebratory. */
  destructive: (): HapticPattern => one('thud'),
  /** Pull-to-refresh passing its threshold. */
  refresh: (): HapticPattern => one('click'),
  toggle: (on: boolean): HapticPattern => one(on ? 'toggleOn' : 'toggleOff'),
  /** Something eased into place: a sheet settling, a card landing. */
  settle: (): HapticPattern => one('soft', true),
} as const;

/** Total length of a pattern in milliseconds. */
export function durationOf(pattern: HapticPattern): number {
  return pattern.reduce((max, event) => Math.max(max, event.at), 0);
}
