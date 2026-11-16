import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * The system has one idea behind it: the interface should feel physical. Primary actions
 * have depth you can press into, motion uses springs rather than timed curves, and every
 * colour carries exactly one meaning. docs/DESIGN.md explains the reasoning.
 *
 * Two complete palettes rather than one with overrides, so every colour has a defined
 * value in both schemes and nothing can fall back to an unstyled default.
 */
export interface Palette {
  bg: string;
  /** Slightly lifted background for headers and sticky bars. */
  bgElevated: string;
  surface: string;
  /** Wells, input backgrounds and resting chips: one step down from `surface`. */
  surfaceAlt: string;
  border: string;
  /** Hairline used over coloured surfaces where `border` would disappear. */
  borderStrong: string;
  text: string;
  textMuted: string;
  textInverse: string;

  /** Brand violet. Also the colour of teaching: skills you offer. */
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  /** The darker lip under a raised primary button. */
  primaryEdge: string;
  /** Text and icons placed on a primary fill. */
  onPrimary: string;

  /** Warm orange. The colour of learning: skills you want. Safe for small text on `learnSoft`. */
  learn: string;
  /** Brighter orange for fills and icons, where text contrast does not apply. */
  learnVivid: string;
  learnSoft: string;

  /** Tertiary accent for variety in stats and illustrations. Carries no meaning of its own. */
  accent: string;
  accentSoft: string;

  /** Green. Success, and a two-way match: an exchange that works in both directions. */
  success: string;
  successSoft: string;
  successEdge: string;
  onSuccess: string;

  warning: string;
  warningSoft: string;

  danger: string;
  dangerSoft: string;
  dangerEdge: string;
  onDanger: string;

  /** The lip under a raised neutral (secondary) button. */
  neutralEdge: string;

  star: string;
  overlay: string;
  /** Base tint for skeleton placeholders and their moving highlight. */
  skeleton: string;
  skeletonHighlight: string;
}

/*
 * Neutrals are tinted toward the brand violet rather than left as pure greys, which is
 * what makes a white card and a violet button look like they belong to the same product.
 * Every text colour is checked against the surfaces it sits on: 4.5:1 for body text.
 */
const light: Palette = {
  bg: '#F7F6FC',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EEF9',
  border: '#E6E3F1',
  borderStrong: '#CFCBE0',
  text: '#16132A',
  textMuted: '#625E7B',
  textInverse: '#FFFFFF',

  primary: '#5B4BE8',
  primaryDeep: '#4334C8',
  primarySoft: '#ECE9FF',
  primaryEdge: '#3A2CB0',
  onPrimary: '#FFFFFF',

  learn: '#B8400A',
  learnVivid: '#F97316',
  learnSoft: '#FFF0E3',

  accent: '#087070',
  accentSoft: '#DDF5F4',

  success: '#0A773C',
  successSoft: '#DDF6E7',
  successEdge: '#075A2D',
  onSuccess: '#FFFFFF',

  warning: '#A8580A',
  warningSoft: '#FDF0D5',

  danger: '#C32538',
  dangerSoft: '#FDE7EA',
  dangerEdge: '#981A29',
  onDanger: '#FFFFFF',

  neutralEdge: '#D8D4EA',

  star: '#F5A524',
  overlay: 'rgba(22, 19, 42, 0.55)',
  skeleton: '#E9E6F3',
  skeletonHighlight: '#F5F3FB',
};

const dark: Palette = {
  bg: '#0D0B18',
  bgElevated: '#151226',
  surface: '#17142A',
  surfaceAlt: '#221E3A',
  border: '#2C2848',
  borderStrong: '#433E66',
  text: '#F2F0FB',
  textMuted: '#A6A1C2',
  textInverse: '#0D0B18',

  primary: '#9A8FFF',
  primaryDeep: '#7B6EF6',
  primarySoft: '#272154',
  primaryEdge: '#6457DC',
  onPrimary: '#120F26',

  learn: '#FFA366',
  learnVivid: '#FF8A3D',
  learnSoft: '#3A2110',

  accent: '#3FD9D2',
  accentSoft: '#0F3432',

  success: '#4ADE94',
  successSoft: '#11321F',
  successEdge: '#2BA869',
  onSuccess: '#06210F',

  warning: '#F7B955',
  warningSoft: '#3A2A0B',

  danger: '#FF7887',
  dangerSoft: '#3D1620',
  dangerEdge: '#D4505F',
  onDanger: '#2A0A10',

  neutralEdge: '#120F22',

  star: '#F7B955',
  overlay: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#221E3A',
  skeletonHighlight: '#2E2A4A',
};

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
 * Elevation. iOS uses shadows, Android uses the native elevation property — applying
 * both everywhere produces a muddy double shadow on Android. Shadows are tinted with the
 * ink colour rather than pure black, which keeps them from looking dirty on a lilac page.
 */
export function elevation(level: 0 | 1 | 2 | 3, dark_: boolean): ViewStyle {
  if (level === 0) return {};

  const spec = {
    1: { radius: 8, offset: 2, opacity: dark_ ? 0.45 : 0.06, android: 2 },
    2: { radius: 18, offset: 6, opacity: dark_ ? 0.55 : 0.09, android: 5 },
    3: { radius: 32, offset: 14, opacity: dark_ ? 0.65 : 0.14, android: 10 },
  }[level];

  if (Platform.OS === 'android') return { elevation: spec.android, shadowColor: '#16132A' };

  return {
    shadowColor: dark_ ? '#000000' : '#2A2456',
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
  /** Two-stop gradients, ready to spread into LinearGradient's `colors`. */
  gradients: {
    primary: readonly [string, string];
    /** The hero gradient: brand violet into a warmer magenta. Used once per screen at most. */
    hero: readonly [string, string, string];
    learn: readonly [string, string];
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
    depth,
    fonts,
    typography: { ...typography, numeric: numericStyle },
    motion,
    dark: isDark,
    elevation: (level) => elevation(level, isDark),
    gradients: {
      primary: [colors.primary, colors.primaryDeep],
      // Fixed stops: this gradient always carries white text, in either scheme.
      hero: ['#6D5BFF', '#5B4BE8', '#8B3FD9'],
      learn: [colors.learnVivid, '#E8590C'],
      accent: [colors.accent, colors.primary],
      success: [colors.success, colors.accent],
      fade: [`${colors.bg}00`, colors.bg],
    },
  };
}

export const palettes = { light, dark };
