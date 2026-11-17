/* global process, console */
/**
 * Checks every colour pairing the app uses against WCAG 2.2 AA, in both themes:
 * 4.5:1 for text (1.4.3) and 3:1 for the graphics and boundaries that identify controls
 * and their state (1.4.11). Reads src/theme/palette.ts directly; no dependencies.
 *
 *   npm run check:contrast
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'theme', 'palette.ts');
const text = fs.readFileSync(file, 'utf8');
function block(name) {
  const start = text.indexOf(`export const ${name}: Palette = {`);
  const end = text.indexOf('};', start);
  return Object.fromEntries([...text.slice(start, end).matchAll(/^\s+(\w+): '(#[0-9A-F]{6})'/gim)].map((m) => [m[1], m[2]]));
}
const light = block('light');
const dark = block('dark');

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
// WCAG ratios are thresholds and must not be rounded: 4.499 fails 4.5.
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const SURFACES = ['background', 'surface', 'surfaceContainer'];
// [foreground, background, minimum, what it is]
const pairs = [];
for (const s of SURFACES) {
  pairs.push(['textPrimary', s, 4.5, 'body text']);
  pairs.push(['textSecondary', s, 4.5, 'secondary text and placeholders']);
  pairs.push(['primary', s, 4.5, 'links and text buttons']);
  pairs.push(['error', s, 4.5, 'field errors']);
  pairs.push(['outline', s, 3, 'input, checkbox and empty-star boundaries (1.4.11)']);
  pairs.push(['reward', s, 3, 'filled stars and streak flames (graphic)']);
}
for (const s of ['background', 'surface']) {
  pairs.push(['tertiary', s, 4.5, '"Learn" label text']);
  pairs.push(['success', s, 4.5, '"Online now", password rules']);
  pairs.push(['warning', s, 4.5, 'rating label text']);
}
pairs.push(['textPrimary', 'surfaceContainerHigh', 4.5, 'text on raised neutral']);
for (const a of ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error']) {
  pairs.push([`on${a[0].toUpperCase()}${a.slice(1)}`, a, 4.5, `text on ${a} fill`]);
  pairs.push([`on${a[0].toUpperCase()}${a.slice(1)}Container`, `${a}Container`, 4.5, `text on ${a} container`]);
}
pairs.push(['onRewardContainer', 'rewardContainer', 4.5, 'text on reward container']);
pairs.push(['onMedal', 'medalGold', 4.5, 'rank number on gold']);

pairs.push(['onMedal', 'medalSilver', 4.5, 'rank number on silver']);
pairs.push(['onMedal', 'medalBronze', 4.5, 'rank number on bronze']);
pairs.push(['textPrimary', 'primaryContainer', 4.5, 'text in highlighted rows (you, unread)']);
pairs.push(['textSecondary', 'primaryContainer', 4.5, 'captions in highlighted rows']);
pairs.push(['textPrimary', 'tertiaryContainer', 4.5, 'skill names in trade card']);
pairs.push(['primary', 'surfaceContainer', 3, 'progress fill against its track']);
pairs.push(['primary', 'primaryContainer', 3, 'score ring arc against its track']);
pairs.push(['success', 'successContainer', 3, 'two-way ring arc against its track']);
pairs.push(['onSecondaryContainer', 'surfaceContainer', 3, 'selected segment tick against the track']);
pairs.push(['primary', 'surface', 3, 'focus border and checked checkbox']);
pairs.push(['success', 'surface', 3, 'online dot (graphic)']);

let fails = 0;
for (const [name, p] of [['light', light], ['dark', dark]]) {
  let worst = Infinity;
  // A medal must stand out from the row it sits on (1.4.11). In light mode its outline does
  // that; in dark mode the light metal fill itself does, and the outline is subsumed into it.
  const extra =
    name === 'light'
      ? [['outline', 'background', 3, 'medal outline'], ['outline', 'primaryContainer', 3, 'medal outline, highlighted row']]
      : ['medalGold', 'medalSilver', 'medalBronze'].flatMap((m) => [
          [m, 'background', 3, 'medal fill'],
          [m, 'primaryContainer', 3, 'medal fill, highlighted row'],
        ]);
  for (const [fg, bg, min, what] of [...pairs, ...extra]) {
    if (!p[fg] || !p[bg]) { fails++; console.log(`MISSING ${name} ${fg} or ${bg}`); continue; }
    const r = ratio(p[fg], p[bg]);
    worst = Math.min(worst, r / min);
    if (r < min) { fails++; console.log(`FAIL ${name} ${fg} on ${bg}: ${r.toFixed(2)} < ${min} (${what})`); }
  }
  console.log(`${name}: ${pairs.length} pairs checked`);
}
// Not-pure-white/black check for large surfaces.
for (const [name, p] of [['light', light], ['dark', dark]])
  for (const k of ['background', 'surface'])
    if (['#FFFFFF', '#000000'].includes(p[k])) { fails++; console.log(`FAIL ${name} ${k} is pure ${p[k]}`); }
console.log(fails === 0 ? 'ALL PASS' : `${fails} failures`);
process.exit(fails ? 1 : 0);
