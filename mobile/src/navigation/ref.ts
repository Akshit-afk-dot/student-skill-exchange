import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Navigation from outside a screen: a tapped push notification, or the in-app banner,
 * which sits above every screen rather than inside one.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export interface CurrentRoute {
  name: string;
  params: Record<string, unknown>;
}

let current: CurrentRoute | null = null;

/** Called by NavigationContainer whenever the focused screen changes. */
export function trackCurrentRoute(): void {
  if (!navigationRef.isReady()) return;
  const route = navigationRef.getCurrentRoute();
  current = route ? { name: route.name, params: (route.params ?? {}) as Record<string, unknown> } : null;
}

/** The screen the student is looking at, including a tab inside the tab bar. */
export function currentRoute(): CurrentRoute | null {
  return current;
}
