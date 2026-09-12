import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * Two complete palettes rather than one with overrides, so every colour has a defined
 * value in both schemes and nothing can fall back to an unstyled default.
 */
export interface Palette {
  bg: string;
  /** Slightly lifted background for headers and sticky bars. */
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  /** Hairline used over coloured surfaces where `border` would disappear. */
  borderStrong: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  star: string;
  overlay: string;
  /** Base tint for skeleton placeholders and their moving highlight. */
  skeleton: string;
  skeletonHighlight: string;
}

const light: Palette = {
  bg: '#F5F6F9',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F5',
  border: '#E3E6EC',
  borderStrong: '#CDD2DC',
  text: '#12131A',
  textMuted: '#686D7A',
  textInverse: '#FFFFFF',
  primary: '#5B4BE8',
  primaryDeep: '#3C2FB8',
  primarySoft: '#ECEAFE',
  accent: '#0EA5A5',
  accentSoft: '#DDF5F4',
  success: '#12A150',
  successSoft: '#DCF5E7',
  warning: '#C2740A',
  warningSoft: '#FDF0D5',
  danger: '#D62E3F',
  dangerSoft: '#FDE5E7',
  star: '#F0A81C',
  overlay: 'rgba(10, 11, 16, 0.5)',
  skeleton: '#E6E9EF',
  skeletonHighlight: '#F3F5F8',
};

const dark: Palette = {
  bg: '#0B0C11',
  bgElevated: '#14161D',
  surface: '#161822',
  surfaceAlt: '#1E212C',
  border: '#282C38',
  borderStrong: '#3A3F4E',
  text: '#ECEEF4',
  textMuted: '#8D93A3',
  textInverse: '#0B0C11',
  primary: '#8B84FF',
  primaryDeep: '#6C63F0',
  primarySoft: '#231F4D',
  accent: '#2DD4CE',
  accentSoft: '#0E3331',
  success: '#3ED47F',
  successSoft: '#0F2E1D',
  warning: '#F5B33C',
  warningSoft: '#3A2A0B',
  danger: '#F86D7C',
  dangerSoft: '#3B161B',
  star: '#F5B33C',
  overlay: 'rgba(0, 0, 0, 0.68)',
  skeleton: '#1E212C',
  skeletonHighlight: '#2A2E3B',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

/**
 * Tabular figures, so an animating counter does not jitter as digit widths change.
 * Typed as TextStyle rather than `as const`: React Native's `fontVariant` expects a
 * mutable array, which a const assertion would make readonly.
 */
export const numericStyle: TextStyle = {
  fontSize: 22,
  fontWeight: '700',
  fontVariant: ['tabular-nums'],
};

/**
 * Motion timings. Shared so everything in the app accelerates and settles alike —
 * inconsistent durations are the main thing that makes an interface feel amateur.
 */
export const motion = {
  instant: 120,
  fast: 200,
  normal: 300,
  slow: 460,
  /** Per-item delay for staggered list entrances. Beyond ~7 items it stops helping. */
  stagger: 45,
  maxStagger: 7,
  spring: { damping: 18, stiffness: 190, mass: 0.9 },
  /** Snappier spring for press feedback, which must not feel laggy. */
  pressSpring: { damping: 22, stiffness: 380, mass: 0.6 },
} as const;

/**
 * Elevation. iOS uses shadows, Android uses the native elevation property — applying
 * both everywhere produces a muddy double shadow on Android.
 */
export function elevation(level: 0 | 1 | 2 | 3, dark_: boolean): ViewStyle {
  if (level === 0) return {};

  const spec = {
    1: { radius: 6, offset: 2, opacity: dark_ ? 0.4 : 0.07, android: 2 },
    2: { radius: 14, offset: 5, opacity: dark_ ? 0.5 : 0.1, android: 5 },
    3: { radius: 26, offset: 10, opacity: dark_ ? 0.6 : 0.14, android: 10 },
  }[level];

  if (Platform.OS === 'android') return { elevation: spec.android };

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: spec.offset },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
  };
}

export interface Theme {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography & { numeric: TextStyle };
  motion: typeof motion;
  dark: boolean;
  elevation(level: 0 | 1 | 2 | 3): ViewStyle;
  /** Two-stop gradients, ready to spread into LinearGradient's `colors`. */
  gradients: {
    primary: readonly [string, string];
    accent: readonly [string, string];
    success: readonly [string, string];
    /** Fades a list into the background behind a floating bar. */
    fade: readonly [string, string];
  };
}

/** Follows the device appearance setting; no in-app toggle to keep in sync. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? dark : light;

  return {
    colors,
    spacing,
    radius,
    typography: { ...typography, numeric: numericStyle },
    motion,
    dark: isDark,
    elevation: (level) => elevation(level, isDark),
    gradients: {
      primary: [colors.primary, colors.primaryDeep],
      accent: [colors.accent, colors.primary],
      success: [colors.success, colors.accent],
      fade: [`${colors.bg}00`, colors.bg],
    },
  };
}

export const palettes = { light, dark };
