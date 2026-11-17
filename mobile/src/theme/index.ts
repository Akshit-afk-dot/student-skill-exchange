import { createElement, createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, Platform, type TextStyle, type ViewStyle } from 'react-native';

import { dark, light, type Palette } from './palette';

/**
 * Design tokens.
 *
 * The system has one idea behind it: the interface should feel physical. Primary actions
 * have depth you can press into, motion uses springs rather than timed curves, and every
 * colour carries exactly one meaning. docs/DESIGN.md explains the reasoning.
 *
 * Colours live in ./palette.ts as roles (primary, surface, textSecondary...). Screens use
 * those roles and never a hex value, so the whole app changes together.
 */
export type { Palette };

/*
 * One typeface, five weights. Each weight is its own font file, so a style picks a
 * family name rather than a `fontWeight`: on Android, asking a single-weight custom font
 * for bold makes the system smear a fake bold over it.
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Maps a CSS-style weight onto the font file that draws it. */
export function fontForWeight(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '500':
    case 500:
      return fonts.medium;
    case '600':
    case 600:
      return fonts.semibold;
    case 'bold':
    case '700':
    case 700:
      return fonts.bold;
    case '800':
    case 800:
    case '900':
    case 900:
      return fonts.extrabold;
    default:
      return fonts.regular;
  }
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Horizontal page margin. Wider than `lg` so content does not crowd the screen edge. */
  page: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Rounder than platform defaults on purpose: soft shapes read as friendly and touchable. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** How far a raised button's face travels when pressed, and so how tall its lip is. */
export const depth = { button: 4, small: 3 } as const;

/**
 * Type scale. Body is 16 with a 24 line height; nothing is smaller than 11.
 * Hierarchy comes from weight and size together, so headings are heavy, not just large.
 */
export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  /** Button labels: heavy and slightly tracked, sized for a 52pt-tall control. */
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 },
} as const satisfies Record<string, TextStyle>;

/**
 * Tabular figures, so an animating counter does not jitter as digit widths change.
 * Typed as TextStyle rather than `as const`: React Native's `fontVariant` expects a
 * mutable array, which a const assertion would make readonly.
 */
export const numericStyle: TextStyle = {
  fontFamily: fonts.extrabold,
  fontSize: 24,
  lineHeight: 30,
  letterSpacing: -0.4,
  fontVariant: ['tabular-nums'],
};

/**
 * Motion.
 *
 * Movement uses springs and colour uses short timed fades, following Material 3's
 * physics system: things that travel may overshoot and settle, things that only change
 * appearance must not. The spring values are Material's own (damping ratio 0.6 to 0.8),
 * converted to the damping coefficient Reanimated expects.
 *
 * Durations stay inside 100 to 300ms for anything a person triggers repeatedly; longer
 * than that starts to feel like waiting.
 */
export const motion = {
  instant: 100,
  fast: 150,
  normal: 220,
  slow: 320,
  /** Per-item delay for staggered list entrances. Beyond ~6 items it stops helping. */
  stagger: 40,
  maxStagger: 6,
  /** General-purpose settle, for anything without a more specific spring below. */
  spring: { damping: 31, stiffness: 380, mass: 1 },
  /** Press feedback. Stiff and nearly critically damped: it must never feel laggy. */
  pressSpring: { damping: 38, stiffness: 900, mass: 0.8 },
  springs: {
    /** Small things: chips, toggles, icons, a button face. Overshoots a little. */
    spatialFast: { damping: 34, stiffness: 800, mass: 1 },
    /** Cards, sheets, anything covering part of the screen. */
    spatial: { damping: 31, stiffness: 380, mass: 1 },
    /** Full-screen movement and hero moments. */
    spatialSlow: { damping: 23, stiffness: 200, mass: 1 },
    /** Deliberately bouncy, for celebration only. */
    bouncy: { damping: 13, stiffness: 240, mass: 1 },
  },
  /** Colour and opacity changes. Never overshoot. */
  effects: { fast: 150, normal: 200, slow: 300 },
} as const;

/**
 * Elevation. iOS uses shadows, Android uses the native elevation property; applying
 * both everywhere produces a muddy double shadow on Android. In dark mode shadows barely
 * read, so depth there comes mostly from raised surfaces being lighter.
 */
export function elevation(level: 0 | 1 | 2 | 3, colors: Palette, dark_: boolean): ViewStyle {
  if (level === 0) return {};

  const spec = {
    1: { radius: 8, offset: 2, opacity: dark_ ? 0.4 : 0.06, android: 2 },
    2: { radius: 18, offset: 6, opacity: dark_ ? 0.5 : 0.08, android: 4 },
    3: { radius: 32, offset: 14, opacity: dark_ ? 0.6 : 0.12, android: 8 },
  }[level];

  if (Platform.OS === 'android') return { elevation: spec.android, shadowColor: colors.shadow };

  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: spec.offset },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
  };
}

export interface Theme {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  depth: typeof depth;
  fonts: typeof fonts;
  typography: typeof typography & { numeric: TextStyle };
  motion: typeof motion;
  dark: boolean;
  elevation(level: 0 | 1 | 2 | 3): ViewStyle;
}

function buildTheme(isDark: boolean): Theme {
  const colors = isDark ? dark : light;
  return {
    colors,
    spacing,
    radius,
    depth,
    fonts,
    typography: { ...typography, numeric: numericStyle },
    motion,
    dark: isDark,
    elevation: (level) => elevation(level, colors, isDark),
  };
}

// Built once each. A stable object means hooks that depend on the theme (t.motion,
// t.colors) do not re-run on every render, and switching scheme swaps one reference.
const LIGHT_THEME = buildTheme(false);
const DARK_THEME = buildTheme(true);

/*
 * One subscription to the device appearance, for the whole app. Per-component colour-scheme
 * hooks each keep their own copy, and on web those copies were seen to disagree after a
 * live switch (the navigator stayed dark while the screen went light). Reading the system
 * value through a single store means every screen always agrees.
 */
function subscribe(onChange: () => void): () => void {
  const subscription = Appearance.addChangeListener(() => onChange());
  return () => subscription.remove();
}
function isDarkNow(): boolean {
  return Appearance.getColorScheme() === 'dark';
}

const ThemeContext = createContext<Theme | null>(null);

/** Follows the device appearance, including changes while the app is open (Auto mode). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, isDarkNow);
  return createElement(ThemeContext.Provider, { value: isDark ? DARK_THEME : LIGHT_THEME }, children);
}

/** The current theme. Outside the provider it falls back to the device setting. */
export function useTheme(): Theme {
  return useContext(ThemeContext) ?? (isDarkNow() ? DARK_THEME : LIGHT_THEME);
}

export const palettes = { light, dark };
