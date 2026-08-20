import { useColorScheme } from 'react-native';

/**
 * Design tokens.
 *
 * Two complete palettes rather than one with overrides, so every colour has a defined
 * value in both schemes and nothing can fall back to an unstyled default.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  star: string;
  overlay: string;
}

const light: Palette = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F2F5',
  border: '#E2E4E9',
  text: '#14151A',
  textMuted: '#6B6F7A',
  textInverse: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#EEF2FF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  star: '#F59E0B',
  overlay: 'rgba(8, 9, 12, 0.55)',
};

const dark: Palette = {
  bg: '#0E0F13',
  surface: '#17191F',
  surfaceAlt: '#1E2027',
  border: '#2A2D36',
  text: '#ECEDF1',
  textMuted: '#9096A3',
  textInverse: '#0E0F13',
  primary: '#818CF8',
  primarySoft: '#1E1B4B',
  success: '#4ADE80',
  successSoft: '#14321F',
  warning: '#FBBF24',
  warningSoft: '#3A2C0C',
  danger: '#F87171',
  dangerSoft: '#3D1719',
  star: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.65)',
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
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

export interface Theme {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  dark: boolean;
}

/** Follows the device appearance setting; no in-app toggle to keep in sync. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    colors: isDark ? dark : light,
    spacing,
    radius,
    typography,
    dark: isDark,
  };
}

export const palettes = { light, dark };
