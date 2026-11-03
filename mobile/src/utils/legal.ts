import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { BASE_URL } from '../api/client';

/** Published in the store listings and the privacy policy; keep all three in step. */
export const SUPPORT_EMAIL = 'akshituzumaki@gmail.com';

/** Served by the API itself, so they always describe the server the app talks to. */
export const LEGAL_URLS = {
  privacy: `${BASE_URL}/legal/privacy`,
  terms: `${BASE_URL}/legal/terms`,
  deleteAccount: `${BASE_URL}/account/delete`,
} as const;

/** Opens a page in an in-app browser sheet, falling back to the system browser. */
export function openPage(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => {
    void Linking.openURL(url).catch(() => undefined);
  });
}

export function contactSupport(): void {
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Skill Exchange support')}`).catch(
    () => undefined,
  );
}
