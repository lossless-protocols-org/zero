/**
 * Every React root index.js registers sets up i18next itself. Release bundles
 * evaluate imports lazily (Metro inline requires), so a root that relies on
 * another root having loaded i18n renders raw copy keys when it starts alone:
 * the Android quick-add sheet did, on a cold launch from a launcher shortcut
 * (found on the Moto, 2026-11-09).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fromRoot} from '../harness/paths';

const index = fs.readFileSync(fromRoot('index.js'), 'utf8');
const imports = new Map(
  [...index.matchAll(/^import \{?\s*(\w+)\s*\}? from '([^']+)';$/gm)].map(([, name, spec]) => [name, spec]),
);
const roots = [...index.matchAll(/registerComponent\([^,]+,\s*\(\)\s*=>\s*(\w+)\)/g)].map(([, name]) => name ?? '');

it('finds the registered roots', () => {
  expect(roots.sort()).toEqual(['App', 'QuickAddRoot']);
});

it.each(roots)('%s imports i18n itself', root => {
  const spec = imports.get(root);
  if (!spec) {
    throw new Error(`no import for ${root} in index.js`);
  }
  const file = ['.tsx', '.ts'].map(ext => fromRoot(spec + ext)).find(candidate => fs.existsSync(candidate));
  if (!file) {
    throw new Error(`${spec} not found`);
  }
  const source = fs.readFileSync(file, 'utf8');
  const i18n = path.relative(path.dirname(file), fromRoot('src', 'i18n')).split(path.sep).join('/');
  const spec18n = i18n.startsWith('.') ? i18n : `./${i18n}`;
  expect(source).toMatch(new RegExp(`^import (\\{[^}]*\\} from )?'${spec18n.replace(/\./g, '\\.')}';`, 'm'));
});
