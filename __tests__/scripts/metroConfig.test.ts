/**
 * metro.config.js swaps zod's every-language messages for English only
 * (scripts/metro/zod-locales-en.js; −295 KB of JS, audit 2026-11-08 §8.5).
 * The swap matches one resolved file path, so a zod release that moves the
 * file would silently bring the 298 KB back: this fails first.
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

type Resolution = {type: 'sourceFile'; filePath: string} | {type: 'empty'};
type Resolve = (context: {resolveRequest: Resolve}, moduleName: string, platform: string | null) => Resolution;

const metro: {resolver: {resolveRequest: Resolve}; ZOD_LOCALES: string} = require('../../metro.config.js');

/** Runs the app's resolver over Metro's own, which resolves `moduleName` to `filePath`. */
const resolveAs = (filePath: string): Resolution => {
  const defaultResolve: Resolve = () => ({type: 'sourceFile', filePath});
  return metro.resolver.resolveRequest({resolveRequest: defaultResolve}, 'any', 'android');
};

it('zod still keeps its locales where the swap looks, and the namespace export still points there', () => {
  expect(fs.existsSync(metro.ZOD_LOCALES)).toBe(true);
  expect(fs.readFileSync(fromRoot('node_modules/zod/v4/classic/external.js'), 'utf8')).toContain(
    'export * as locales from "../locales/index.js"',
  );
});

it('sends zod’s locale index to the English-only stand-in, and nothing else', () => {
  expect(resolveAs(metro.ZOD_LOCALES)).toEqual({
    type: 'sourceFile',
    filePath: fromRoot('scripts/metro/zod-locales-en.js'),
  });
  const other = fromRoot('node_modules/zod/v4/locales/en.js');
  expect(resolveAs(other)).toEqual({type: 'sourceFile', filePath: other});
});

it('zod registers English by itself, so the stand-in only has to export it', () => {
  expect(fs.readFileSync(fromRoot('node_modules/zod/v4/classic/schemas.js'), 'utf8')).toMatch(
    /import en from "\.\.\/locales\/en\.js"/,
  );
  expect(fs.readFileSync(fromRoot('scripts/metro/zod-locales-en.js'), 'utf8')).toContain(
    "export {default as en} from 'zod/v4/locales/en.js';",
  );
});
