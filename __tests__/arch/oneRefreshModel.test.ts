/**
 * One refresh model (audit 2026-11-08, Appendix A: "refresh-after-write is a
 * manual contract", "two refresh models for one figure"):
 * - screens read what they show through ui/hooks/useFreshWhileFocused (on
 *   focus, and after writes while focused), so `useFocusEffect` appears only
 *   there, plus the debtor screen's clear-before-read;
 * - session data (categories, currency) follows the database
 *   (store/followSession);
 * - so no writer refetches before navigating back: a `dispatch(fetch…)`
 *   followed by `goBack()` in the same handler is the old contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const sources = walk(fromRoot('src'))
  .filter(file => /\.tsx?$/.test(file))
  .map(file => ({file: path.relative(fromRoot(), file), text: fs.readFileSync(file, 'utf8')}));

const FOCUS_EFFECT_ALLOWED = new Set([
  'src/ui/hooks/useFreshWhileFocused.ts',
  // Clears another person's header before useFreshWhileFocused reads this one's.
  'src/features/money/screens/IndividualDebtsScreen/useIndividualDebts.ts',
]);

it('useFocusEffect only inside useFreshWhileFocused (and the one documented clear)', () => {
  const users = sources.filter(({text}) => /\buseFocusEffect\(/.test(text)).map(({file}) => file);
  expect(users.filter(file => !FOCUS_EFFECT_ALLOWED.has(file))).toEqual([]);
});

it('no handler refetches and then navigates back', () => {
  const offenders = sources.flatMap(({file, text}) =>
    [...text.matchAll(/dispatch\(fetch\w+\([^)]*\)\);?\s*\n(?:\s*[^\n]*\n){0,2}?\s*goBack\(\)/g)].map(
      match => `${file}: ${match[0].replace(/\s+/g, ' ').trim()}`,
    ),
  );
  expect(offenders).toEqual([]);
});
