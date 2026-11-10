import path from 'node:path';

/**
 * The repository root, for tests that read source, fixtures or contracts, or
 * run a script. One definition, so moving a test to another folder never
 * breaks its paths (`${__dirname}/../../..` did).
 */
export const REPO_ROOT = path.resolve(__dirname, '../..');

/** A path inside the repository: `fromRoot('scripts', 'seed-backup.mjs')`. */
export const fromRoot = (...parts: string[]): string => path.join(REPO_ROOT, ...parts);
