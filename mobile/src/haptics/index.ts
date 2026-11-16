import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { prefs } from '../utils/prefs';
import {
  achievement,
  cascade,
  connection,
  holdToConfirm,
  messageReceived,
  messageSent,
  scoreReveal,
  sent,
  simple,
  starRating,
  type HapticPattern,
} from './patterns';
import { fire, hapticsSupported, minGapFor, type AndroidEngine } from './primitives';

/**
 * The haptics engine: plays patterns, and owns the settings that decide whether to.
 *
 * Screens never call the device directly. They ask for a meaning (`haptics.success()`,
 * `haptics.scoreReveal(82, 900)`) and this decides what, if anything, the phone does.
 */

/**
 * - off:    nothing, ever.
 * - subtle: only the events that carry a message. No texture, no decoration.
 * - full:   everything, including the ticks that accompany motion.
 */
export type HapticLevel = 'off' | 'subtle' | 'full';

export interface HapticSettings {
  level: HapticLevel;
  /** Android only. See primitives.ts for what each engine means. */
  engine: AndroidEngine;
}

const LEVEL_KEY = 'sse.haptics.level';
const ENGINE_KEY = 'sse.haptics.engine';

let settings: HapticSettings = { level: 'full', engine: 'system' };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Loads the saved settings. Called once at startup; defaults apply until it resolves. */
export async function initHaptics(): Promise<void> {
  const [level, engine] = await Promise.all([prefs.get(LEVEL_KEY), prefs.get(ENGINE_KEY)]);
  settings = {
    level: level === 'off' || level === 'subtle' || level === 'full' ? level : settings.level,
    engine: engine === 'vibration' || engine === 'system' ? engine : settings.engine,
  };
  emit();
}

export function setHapticLevel(level: HapticLevel): void {
  settings = { ...settings, level };
  void prefs.set(LEVEL_KEY, level);
  emit();
}

export function setHapticEngine(engine: AndroidEngine): void {
  settings = { ...settings, engine };
  void prefs.set(ENGINE_KEY, engine);
  emit();
}

/** Live settings for the Settings screen. */
export function useHapticSettings(): HapticSettings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => settings,
    () => settings,
  );
}

const pending = new Set<ReturnType<typeof setTimeout>>();
let lastFiredAt = 0;

/** Stops every pattern in flight. */
export function cancelHaptics(): void {
  for (const timer of pending) clearTimeout(timer);
  pending.clear();
}

// A pattern must not finish playing into someone's pocket after they leave the app.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') cancelHaptics();
});

/**
 * Plays a pattern and returns a function that cancels whatever has not played yet.
 * Call the canceller when the thing the pattern accompanies goes away: a screen
 * unmounting mid-animation, a finger lifting from a hold.
 */
export function play(pattern: HapticPattern): () => void {
  if (!hapticsSupported || settings.level === 'off') return () => undefined;

  const mine: Array<ReturnType<typeof setTimeout>> = [];
  const minGap = minGapFor(settings.engine);

  for (const event of pattern) {
    if (event.detail && settings.level !== 'full') continue;

    const run = () => {
      const now = Date.now();
      // Two patterns can overlap (a tap during a score reveal). Texture gives way;
      // anything that carries a message always plays.
      if (event.detail && now - lastFiredAt < minGap) return;
      lastFiredAt = now;
      fire(event.p, settings.engine);
    };

    if (event.at <= 0) {
      run();
      continue;
    }
    const timer = setTimeout(() => {
      pending.delete(timer);
      run();
    }, event.at);
    pending.add(timer);
    mine.push(timer);
  }

  return () => {
    for (const timer of mine) {
      clearTimeout(timer);
      pending.delete(timer);
    }
  };
}

/**
 * What screens call. Named for meaning, so the same kind of event feels the same
 * everywhere and changing how it feels is a one-line edit in patterns.ts.
 */
export const haptics = {
  /** A tab, chip, segment or picker value changed. */
  selection: () => void play(simple.selection()),
  /** A card or row was opened. */
  tap: () => void play(simple.tap()),
  /** A committing action: sending, saving, scheduling. */
  press: () => void play(simple.press()),
  /** A raised button going down, and coming back up. */
  keyDown: () => void play(simple.keyDown()),
  keyUp: () => void play(simple.keyUp()),
  success: () => void play(simple.success()),
  warn: () => void play(simple.warn()),
  error: () => void play(simple.error()),
  /** Declining, deleting, cancelling. */
  reject: () => void play(simple.destructive()),
  refresh: () => void play(simple.refresh()),
  toggle: (on: boolean) => void play(simple.toggle(on)),
  settle: () => void play(simple.settle()),

  /** Something was sent and the server accepted it. */
  sent: () => void play(sent()),
  messageSent: () => void play(messageSent()),
  messageReceived: () => void play(messageReceived()),
  achievement: () => void play(achievement()),
  starRating: (stars: number) => void play(starRating(stars)),

  // These accompany an animation, so they hand back a canceller.
  scoreReveal: (score: number, durationMs: number, twoWay = false) =>
    play(scoreReveal(score, durationMs, twoWay)),
  connection: () => play(connection()),
  holdToConfirm: (durationMs: number) => play(holdToConfirm(durationMs)),
  cascade: (count: number, intervalMs: number) => play(cascade(count, intervalMs)),
} as const;

/** The haptics that take no arguments, so a component can accept one by name. */
export type SimpleHaptic =
  | 'selection'
  | 'tap'
  | 'press'
  | 'keyDown'
  | 'keyUp'
  | 'success'
  | 'warn'
  | 'error'
  | 'reject'
  | 'refresh'
  | 'settle'
  | 'sent';

export type { AndroidEngine, HapticPattern };
export { hapticsSupported };
