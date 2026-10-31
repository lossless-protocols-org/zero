#!/usr/bin/env node
/**
 * WCAG contrast of the colour pairs the app actually draws (M31, v2.7.1),
 * read from the theme tokens in src/context/ThemeContext.tsx, for both
 * themes. Text needs 4.5:1, UI parts (icons, borders, focus) 3:1.
 *
 * Usage: bun run contrast   (node scripts/contrast-check.mjs)
 * Exits 1 on any failure not in ACCEPTED, and on an ACCEPTED pair that now
 * passes (so the list cannot go stale).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/context/ThemeContext.tsx'), 'utf8');

const readTheme = name => {
  const block = new RegExp(`const ${name}: ThemeColors = \\{([\\s\\S]*?)\\};`).exec(source);
  if (!block) {
    throw new Error(`contrast-check: ${name} not found in ThemeContext.tsx`);
  }
  return Object.fromEntries([...block[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map(m => [m[1], m[2]]));
};

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const channel = c => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
/** `fg` drawn at `alpha` over `bg`. */
const blend = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [what, foreground token, background token, minimum, foreground opacity]
const PAIRS = [
  ['body text on page', 'primaryText', 'primaryBackground', 4.5],
  ['secondary text on page', 'secondaryText', 'primaryBackground', 4.5],
  ['secondary text on card', 'secondaryText', 'secondaryAccent', 4.5],
  ['over-budget text on card', 'accentOrange', 'secondaryAccent', 4.5],
  ['green text on page (section titles)', 'accentGreen', 'primaryBackground', 4.5],
  ['label on green (month pill, Undo, OK)', 'buttonText', 'accentGreen', 4.5],
  ['label on red (dialog Cancel)', 'buttonText', 'accentRed', 4.5],
  ['blue icon on card (info dialog)', 'accentBlue', 'secondaryAccent', 3.0],
  ['hidden legend row text', 'primaryText', 'secondaryAccent', 4.5, 0.65],
  ['input border on page', 'inputBorder', 'primaryBackground', 3.0],
  ['input border on card', 'inputBorder', 'secondaryAccent', 3.0],
];

// Known failures, kept until the owner decides the brand tints (M31): the
// light theme's accentOrange / accentGreen / accentBlue. Proposed values that
// pass: #9A5A00 (4.73), #5F7A2F (4.66 / label 4.87), #0B6BCB (4.56).
const ACCEPTED = new Set([
  'LightColors: over-budget text on card',
  'LightColors: green text on page (section titles)',
  'LightColors: label on green (month pill, Undo, OK)',
  'LightColors: blue icon on card (info dialog)',
]);

let failures = 0;
let unexpected = 0;
for (const theme of ['LightColors', 'DarkColors']) {
  const colors = readTheme(theme);
  console.log(theme);
  for (const [what, fgName, bgName, minimum, alpha = 1] of PAIRS) {
    if (!colors[fgName] || !colors[bgName]) {
      console.log(`  ?    ${what}: token ${colors[fgName] ? bgName : fgName} missing`);
      failures++;
      unexpected++;
      continue;
    }
    const bg = rgb(colors[bgName]);
    const fg = blend(rgb(colors[fgName]), bg, alpha);
    const value = ratio(fg, bg);
    const pass = value >= minimum;
    const accepted = ACCEPTED.has(`${theme}: ${what}`);
    if (!pass) failures++;
    if (pass === accepted) unexpected++;
    const mark = pass ? (accepted ? 'ok! ' : 'ok  ') : accepted ? 'known' : 'FAIL';
    console.log(`  ${mark.padEnd(5)} ${value.toFixed(2).padStart(5)} ≥ ${minimum}  ${what}`);
  }
}
console.log(`contrast-check: ${failures} below the minimum, ${unexpected} unexpected`);
if (unexpected > 0) {
  console.log('A new failure, or an accepted one that now passes ("ok!"): fix it or update ACCEPTED.');
}
process.exit(unexpected > 0 ? 1 : 0);
