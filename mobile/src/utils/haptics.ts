import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback, with intent-named functions rather than raw intensity levels.
 *
 * Naming them by meaning ("confirm", "reject") instead of strength keeps the vocabulary
 * consistent across screens — the same kind of event always feels the same, and changing
 * how "confirm" feels is a one-line edit here rather than a hunt through the app.
 *
 * Every call is a no-op on web and silently swallows failure: a device without a taptic
 * engine, or one where the user disabled system haptics, must never crash a screen.
 */

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<void>): void {
  if (!enabled) return;
  void fn().catch(() => undefined);
}

/** Light tick. Selecting a chip, switching a tab, changing a filter. */
export function selection(): void {
  run(() => Haptics.selectionAsync());
}

/** Standard tap. The default for a button press that does something. */
export function tap(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Weightier tap for a significant, committing action — sending, scheduling, saving. */
export function press(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Something completed successfully: request accepted, session booked, review posted. */
export function success(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something needs attention but is not an error: validation failed, nothing to submit. */
export function warn(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** The action failed. Network error, rejected request, server refused. */
export function error(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Declining or destroying something — decline a request, delete a skill, cancel a session. */
export function reject(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export const haptics = {
  selection,
  tap,
  press,
  success,
  warn,
  error,
  reject,
};
