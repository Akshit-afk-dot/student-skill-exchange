/**
 * Colour tokens. Every colour the app draws comes from here, by role, never by value.
 *
 * GENERATED, do not edit by hand: change KEYS in scripts/generate-palette.mjs and
 * regenerate (instructions there), then run npm run check:contrast. Each value is a tone of one tonal palette,
 * noted beside it, assigned with Material 3's standard tones (light theme: accent 40,
 * on-accent 100, container 90, on-container 30; dark theme: 80, 20, 30, 90).
 *
 * Key colours (HCT):
 *   primary         hue 284, chroma 52
 *   secondary       hue 284, chroma 14
 *   tertiary        hue 198, chroma 26
 *   neutral         hue 256, chroma 4
 *   neutralVariant  hue 256, chroma 8
 *   success         hue 150, chroma 44
 *   warning         hue 52, chroma 50
 *   error           hue 25, chroma 72
 *   reward          hue 84, chroma 60
 *   bronze          hue 55, chroma 40
 *
 * The neutrals carry a trace of blue so surfaces look cool and clean beside the indigo
 * brand, rather than warm or grey. Light and dark are designed separately: in dark mode
 * the background is darkest and raised surfaces get lighter, as Apple's base and elevated
 * backgrounds do. Neither theme uses pure white or pure black for a large area.
 */
export interface Palette {
  /** Screen background, behind everything. */
  background: string;
  /** Cards, sheets, bars. One step forward from the background (lighter in both themes). */
  surface: string;
  /** Wells inside a surface: tracks, resting chips, segmented controls. */
  surfaceContainer: string;
  /** The most raised neutral: a selected thumb on a dark track, pressed rows. */
  surfaceContainerHigh: string;
  /** Main readable content. */
  textPrimary: string;
  /** Supporting text, captions and placeholders. 4.5:1 or better on every surface. */
  textSecondary: string;
  /** Hairlines and dividers. Decorative only: never the sole outline of a control. */
  border: string;
  /** Boundaries that identify a control: inputs, checkboxes, empty stars. 3:1 or better. */
  outline: string;
  /** The lip under a raised neutral button. */
  neutralEdge: string;
  /** Loading placeholder. */
  skeleton: string;
  /** The highlight that sweeps across a placeholder. */
  skeletonHighlight: string;
  /** The brand. Main buttons, links, active states, progress, and "teach". */
  primary: string;
  /** Text and icons on primary. */
  onPrimary: string;
  /** Soft brand fill: the next-up card, teach chips. */
  primaryContainer: string;
  /** Text and icons on primaryContainer. */
  onPrimaryContainer: string;
  /** The lip under a raised primary button. */
  primaryEdge: string;
  /** Quieter controls. */
  secondary: string;
  /** Text and icons on secondary. */
  onSecondary: string;
  /** Selected states: chips, segments, the active tab, tonal buttons. */
  secondaryContainer: string;
  /** Text and icons on secondaryContainer. */
  onSecondaryContainer: string;
  /** The contrasting accent, used for one meaning only: "learn". */
  tertiary: string;
  /** Text and icons on tertiary. */
  onTertiary: string;
  /** Learn chips and tiles. */
  tertiaryContainer: string;
  /** Text and icons on tertiaryContainer. */
  onTertiaryContainer: string;
  /** Success, accepted, and two-way matches. */
  success: string;
  /** Text and icons on success. */
  onSuccess: string;
  /** Soft success fill. */
  successContainer: string;
  /** Text and icons on successContainer. */
  onSuccessContainer: string;
  /** The lip under a raised success button. */
  successEdge: string;
  /** Warnings and pending states. */
  warning: string;
  /** Text and icons on warning. */
  onWarning: string;
  /** Soft warning fill. */
  warningContainer: string;
  /** Text and icons on warningContainer. */
  onWarningContainer: string;
  /** Errors and destructive actions. */
  error: string;
  /** Text and icons on error. */
  onError: string;
  /** Soft error fill. */
  errorContainer: string;
  /** Text and icons on errorContainer. */
  onErrorContainer: string;
  /** The lip under a raised destructive button. */
  errorEdge: string;
  /** Stars, streaks, points and badges. A graphic colour (3:1), not for small text. */
  reward: string;
  /** Soft reward fill. */
  rewardContainer: string;
  /** Text and icons on rewardContainer. */
  onRewardContainer: string;
  /** First place. Medals are outlined in `outline`, which carries the 3:1. */
  medalGold: string;
  /** Second place. */
  medalSilver: string;
  /** Third place. */
  medalBronze: string;
  /** Rank numbers on a medal. Dark ink in both themes. */
  onMedal: string;
  /** Shadow colour for elevation. */
  shadow: string;
}

export const light: Palette = {
  background: '#F4F3F7', // neutral 96
  surface: '#FDFCFF', // neutral 99
  surfaceContainer: '#EBEAEE', // neutral 93
  surfaceContainerHigh: '#E3E2E6', // neutral 90
  textPrimary: '#1A1C1E', // neutral 10
  textSecondary: '#5A5F66', // neutralVariant 40
  border: '#D9DDE6', // neutralVariant 88
  outline: '#787C84', // neutralVariant 52
  neutralEdge: '#C9CCD5', // neutralVariant 82
  skeleton: '#E8E8EB', // neutral 92
  skeletonHighlight: '#F7F6FA', // neutral 97
  primary: '#5054B1', // primary 40
  onPrimary: '#FFFFFF', // primary 100
  primaryContainer: '#E1E0FF', // primary 90
  onPrimaryContainer: '#383B98', // primary 30
  primaryEdge: '#333693', // primary 28
  secondary: '#5D5D6F', // secondary 40
  onSecondary: '#FFFFFF', // secondary 100
  secondaryContainer: '#E2E0F6', // secondary 90
  onSecondaryContainer: '#454556', // secondary 30
  tertiary: '#326667', // tertiary 40
  onTertiary: '#FFFFFF', // tertiary 100
  tertiaryContainer: '#B7ECED', // tertiary 90
  onTertiaryContainer: '#164E4F', // tertiary 30
  success: '#266B35', // success 40
  onSuccess: '#FFFFFF', // success 100
  successContainer: '#AAF4AF', // success 90
  onSuccessContainer: '#035320', // success 30
  successEdge: '#004D1D', // success 28
  warning: '#974800', // warning 40
  onWarning: '#FFFFFF', // warning 100
  warningContainer: '#FFDBC7', // warning 90
  onWarningContainer: '#733600', // warning 30
  error: '#B12C25', // error 40
  onError: '#FFFFFF', // error 100
  errorContainer: '#FFDAD6', // error 90
  onErrorContainer: '#8F1011', // error 30
  errorEdge: '#88090D', // error 28
  reward: '#A67A00', // reward 54
  rewardContainer: '#FFE5B8', // reward 92
  onRewardContainer: '#5C4200', // reward 30
  medalGold: '#FFC238', // reward 82
  medalSilver: '#CED1DA', // neutralVariant 84
  medalBronze: '#FFAF74', // bronze 78
  onMedal: '#1A1C1E', // neutral 10
  shadow: '#1A1C1E', // neutral 10
};

export const dark: Palette = {
  background: '#121316', // neutral 6
  surface: '#1E2022', // neutral 12
  surfaceContainer: '#292A2D', // neutral 17
  surfaceContainerHigh: '#38393C', // neutral 24
  textPrimary: '#E8E8EB', // neutral 92
  textSecondary: '#B2B6BF', // neutralVariant 74
  border: '#353940', // neutralVariant 24
  outline: '#888C94', // neutralVariant 58
  neutralEdge: '#0A0E14', // neutralVariant 4
  skeleton: '#292A2D', // neutral 17
  skeletonHighlight: '#38393C', // neutral 24
  primary: '#C0C1FF', // primary 80
  onPrimary: '#1F2181', // primary 20
  primaryContainer: '#383B98', // primary 30
  onPrimaryContainer: '#E1E0FF', // primary 90
  primaryEdge: '#888DEE', // primary 62
  secondary: '#C6C4D9', // secondary 80
  onSecondary: '#2F2F3F', // secondary 20
  secondaryContainer: '#454556', // secondary 30
  onSecondaryContainer: '#E2E0F6', // secondary 90
  tertiary: '#9BD0D0', // tertiary 80
  onTertiary: '#003737', // tertiary 20
  tertiaryContainer: '#164E4F', // tertiary 30
  onTertiaryContainer: '#B7ECED', // tertiary 90
  success: '#8FD795', // success 80
  onSuccess: '#003913', // success 20
  successContainer: '#035320', // success 30
  onSuccessContainer: '#AAF4AF', // success 90
  successEdge: '#60A568', // success 62
  warning: '#FFB688', // warning 80
  onWarning: '#512400', // warning 20
  warningContainer: '#733600', // warning 30
  onWarningContainer: '#FFDBC7', // warning 90
  error: '#FFB4AB', // error 80
  onError: '#690005', // error 20
  errorContainer: '#8F1011', // error 30
  onErrorContainer: '#FFDAD6', // error 90
  errorEdge: '#FD6256', // error 62
  reward: '#FDBB04', // reward 80
  rewardContainer: '#5C4200', // reward 30
  onRewardContainer: '#FFDEA3', // reward 90
  medalGold: '#FDBB04', // reward 80
  medalSilver: '#BDC1CA', // neutralVariant 78
  medalBronze: '#EF9E61', // bronze 72
  onMedal: '#1A1C1E', // neutral 10
  shadow: '#000000', // neutral 0
};
