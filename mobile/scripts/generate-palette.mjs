/* global process, console */
/**
 * Generates src/theme/palette.ts: every colour token, for light and dark, as tones of a few
 * tonal palettes (Material Color Utilities' HCT colour space).
 *
 * To change the colour scheme, edit KEYS below, then from mobile/:
 *   npm install --no-save @material/material-color-utilities@0.3.0
 *   node scripts/generate-palette.mjs src/theme/palette.ts
 *   npm run check:contrast
 *
 * Tone assignments follow Material 3: accents at 40 (light) and 80 (dark), on-accent
 * 100 and 20, containers 90 and 30, on-containers 30 and 90. Neutral surfaces step
 * forward in lightness in dark mode, as Apple's base and elevated backgrounds do.
 */
import { TonalPalette, hexFromArgb } from '@material/material-color-utilities';
import fs from 'node:fs';

// The key colours, as HCT [hue, chroma]. Everything below is derived from these.
const KEYS = {
  primary: [284, 52], secondary: [284, 14], tertiary: [198, 26],
  neutral: [256, 4], neutralVariant: [256, 8],
  success: [150, 44], warning: [52, 50], error: [25, 72], reward: [84, 60], bronze: [55, 40],
};
const P = Object.fromEntries(Object.entries(KEYS).map(([k, [h, c]]) => [k, TonalPalette.fromHueAndChroma(h, c)]));
const T = (p, t) => ({ hex: hexFromArgb(P[p].tone(t)).toUpperCase(), src: `${p} ${t}` });
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const accent = (p, light, edge = true) => Object.fromEntries([
  [p, T(p, light ? 40 : 80)],
  [`on${cap(p)}`, T(p, light ? 100 : 20)],
  [`${p}Container`, T(p, light ? 90 : 30)],
  [`on${cap(p)}Container`, T(p, light ? 30 : 90)],
  ...(edge ? [[`${p}Edge`, T(p, light ? 28 : 62)]] : []),
]);
const scheme = (L) => ({
  // Neutral surfaces, back to front.
  background: T('neutral', L ? 96 : 6),
  surface: T('neutral', L ? 99 : 12),
  surfaceContainer: T('neutral', L ? 93 : 17),
  surfaceContainerHigh: T('neutral', L ? 90 : 24),
  textPrimary: T('neutral', L ? 10 : 92),
  textSecondary: T('neutralVariant', L ? 40 : 74),
  border: T('neutralVariant', L ? 88 : 24),
  outline: T('neutralVariant', L ? 52 : 58),
  neutralEdge: T('neutralVariant', L ? 82 : 4),
  skeleton: T('neutral', L ? 92 : 17),
  skeletonHighlight: T('neutral', L ? 97 : 24),
  ...accent('primary', L), ...accent('secondary', L, false), ...accent('tertiary', L, false),
  ...accent('success', L), ...accent('warning', L, false), ...accent('error', L),
  reward: T('reward', L ? 54 : 80),
  rewardContainer: T('reward', L ? 92 : 30),
  onRewardContainer: T('reward', L ? 30 : 90),
  medalGold: T('reward', L ? 82 : 80),
  medalSilver: T('neutralVariant', L ? 84 : 78),
  medalBronze: T('bronze', L ? 78 : 72),
  onMedal: T('neutral', 10),
  shadow: T('neutral', L ? 10 : 0),
});
const light = scheme(true), dark = scheme(false);

const DOC = {
  background: 'Screen background, behind everything.',
  surface: 'Cards, sheets, bars. One step forward from the background (lighter in both themes).',
  surfaceContainer: 'Wells inside a surface: tracks, resting chips, segmented controls.',
  surfaceContainerHigh: 'The most raised neutral: a selected thumb on a dark track, pressed rows.',
  textPrimary: 'Main readable content.',
  textSecondary: 'Supporting text, captions and placeholders. 4.5:1 or better on every surface.',
  border: 'Hairlines and dividers. Decorative only: never the sole outline of a control.',
  outline: 'Boundaries that identify a control: inputs, checkboxes, empty stars. 3:1 or better.',
  neutralEdge: 'The lip under a raised neutral button.',
  skeleton: 'Loading placeholder.', skeletonHighlight: 'The highlight that sweeps across a placeholder.',
  primary: 'The brand. Main buttons, links, active states, progress, and "teach".',
  onPrimary: 'Text and icons on primary.', primaryContainer: 'Soft brand fill: the next-up card, teach chips.',
  onPrimaryContainer: 'Text and icons on primaryContainer.', primaryEdge: 'The lip under a raised primary button.',
  secondary: 'Quieter controls.', onSecondary: 'Text and icons on secondary.',
  secondaryContainer: 'Selected states: chips, segments, the active tab, tonal buttons.',
  onSecondaryContainer: 'Text and icons on secondaryContainer.',
  tertiary: 'The contrasting accent, used for one meaning only: "learn".', onTertiary: 'Text and icons on tertiary.',
  tertiaryContainer: 'Learn chips and tiles.', onTertiaryContainer: 'Text and icons on tertiaryContainer.',
  success: 'Success, accepted, and two-way matches.', onSuccess: 'Text and icons on success.',
  successContainer: 'Soft success fill.', onSuccessContainer: 'Text and icons on successContainer.', successEdge: 'The lip under a raised success button.',
  warning: 'Warnings and pending states.', onWarning: 'Text and icons on warning.',
  warningContainer: 'Soft warning fill.', onWarningContainer: 'Text and icons on warningContainer.',
  error: 'Errors and destructive actions.', onError: 'Text and icons on error.',
  errorContainer: 'Soft error fill.', onErrorContainer: 'Text and icons on errorContainer.', errorEdge: 'The lip under a raised destructive button.',
  reward: 'Stars, streaks, points and badges. A graphic colour (3:1), not for small text.',
  rewardContainer: 'Soft reward fill.', onRewardContainer: 'Text and icons on rewardContainer.',
  medalGold: 'First place. Medals are outlined in `outline`, which carries the 3:1.',
  medalSilver: 'Second place.', medalBronze: 'Third place.',
  onMedal: 'Rank numbers on a medal. Dark ink in both themes.',
  shadow: 'Shadow colour for elevation.',
};
const body = (s) => Object.entries(s).map(([k, v]) => `  ${k}: '${v.hex}', // ${v.src}`).join('\n');
const iface = Object.keys(light).map((k) => `  /** ${DOC[k]} */\n  ${k}: string;`).join('\n');
const keys = Object.entries(KEYS).map(([k, [h, c]]) => ` *   ${k.padEnd(15)} hue ${h}, chroma ${c}`).join('\n');
const src = `/**
 * Colour tokens. Every colour the app draws comes from here, by role, never by value.
 *
 * GENERATED, do not edit by hand: change KEYS in scripts/generate-palette.mjs and
 * regenerate (instructions there), then run npm run check:contrast. Each value is a tone of one tonal palette,
 * noted beside it, assigned with Material 3's standard tones (light theme: accent 40,
 * on-accent 100, container 90, on-container 30; dark theme: 80, 20, 30, 90).
 *
 * Key colours (HCT):
${keys}
 *
 * The neutrals carry a trace of blue so surfaces look cool and clean beside the indigo
 * brand, rather than warm or grey. Light and dark are designed separately: in dark mode
 * the background is darkest and raised surfaces get lighter, as Apple's base and elevated
 * backgrounds do. Neither theme uses pure white or pure black for a large area.
 */
export interface Palette {
${iface}
}

export const light: Palette = {
${body(light)}
};

export const dark: Palette = {
${body(dark)}
};
`;
fs.writeFileSync(process.argv[2], src);
console.log('wrote', process.argv[2], Object.keys(light).length, 'tokens');
