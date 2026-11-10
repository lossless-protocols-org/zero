/**
 * The app version. Written by `scripts/bump-version.js` together with
 * package.json's; `__tests__/scripts/bumpVersion.test.ts` checks they agree.
 * It used to be read by importing package.json, which put the whole file in
 * the bundle, the internal `//dependencyNotes` included (audit 2026-11-08
 * §8.3). The migration runner compares it to decide whether a permanent
 * migration failure belongs to the current build.
 */
const APP_VERSION = '2.8.0';

export const getAppVersion = (): string => APP_VERSION;
