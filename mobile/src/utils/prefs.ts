import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small on-device preferences, such as the haptics setting.
 *
 * Uses the same storage as the session tokens so the app has one persistence mechanism
 * rather than two. Nothing here is secret; it is simply where small values already live.
 * Every call swallows failure: a preference that cannot be saved falls back to its
 * default, which is never worth an error on screen.
 */
export const prefs = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Not persisted; the in-memory value still applies for this session.
    }
  },
};
