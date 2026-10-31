/**
 * L3 (v2.7.1): a restore of a large backup must stay ONE atomic batch but
 * stop being a cliff. Before: `database.batch(...destroys, ..., ...newExpenses)`
 * spread up to 2×N prepared records into a single call (WatermelonDB itself
 * warns this can exceed the maximum call stack), and the screen flipped every
 * entity to "syncing" at once and to "done" at once, so a 20k import looked
 * frozen. Now the batch takes one array, the service reports progress per
 * entity group, and it yields to the event loop between groups so the screen
 * can paint. LokiJS harness as in importService.test.ts; the timings printed
 * here are LokiJS, not SQLite.
 */
import type {Database} from '@nozbe/watermelondb';
import type {ExportData} from '../src/backend/export/format';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('importScaleTest'),
);

// required after jest.mock so the mock applies; each cast names the module's own type
const {database} = require('../src/watermelondb/database') as {database: Database};
const {importAllData} =
  require('../src/watermelondb/services/importService') as typeof import('../src/watermelondb/services/importService');
const {validateExportEnvelope} =
  require('../src/backend/export/validate') as typeof import('../src/backend/export/validate');
const {upgradeExportData} =
  require('../src/backend/export/upgrader') as typeof import('../src/backend/export/upgrader');

const {execFileSync} = require('child_process');
const {mkdtempSync, readFileSync} = require('fs');
const {tmpdir} = require('os');
const {join, resolve} = require('path');
const {performance} = require('perf_hooks');
declare const __dirname: string;

const loadSeed = (count: number): ExportData => {
  const dir = mkdtempSync(join(tmpdir(), 'zero-l3-'));
  const out = join(dir, `seed_${count}.json`);
  execFileSync('node', [resolve(__dirname, '../scripts/seed-backup.mjs'), String(count), '--compact', '--out', out]);
  const validation = validateExportEnvelope(JSON.parse(readFileSync(out, 'utf8')));
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'seed did not validate');
  }
  return upgradeExportData(validation.data);
};

const countAll = async () => ({
  users: await database.get('users').query().fetchCount(),
  categories: await database.get('categories').query().fetchCount(),
  expenses: await database.get('expenses').query().fetchCount(),
  currencies: await database.get('currencies').query().fetchCount(),
  debtors: await database.get('debtors').query().fetchCount(),
  debts: await database.get('debts').query().fetchCount(),
  budgets: await database.get('budgets').query().fetchCount(),
});

describe('importAllData at scale (L3)', () => {
  jest.setTimeout(120_000);

  it('restores the 20k seed in ONE batch passed as a single array, with identical counts', async () => {
    const seed = loadSeed(20000);
    const batchSpy = jest.spyOn(database, 'batch');
    const phases: string[] = [];

    const t0 = performance.now();
    const {stats} = await importAllData(seed, phase => {
      phases.push(phase);
    });
    const ms = performance.now() - t0;
    console.log(`[L3] 20k restore (LokiJS): ${ms.toFixed(0)} ms`);

    expect(batchSpy).toHaveBeenCalledTimes(1);
    const args = batchSpy.mock.calls[0] ?? [];
    expect(args).toHaveLength(1);
    expect(Array.isArray(args[0])).toBe(true);

    const counts = await countAll();
    expect(counts).toEqual({
      users: 1,
      categories: seed.categories.length,
      expenses: seed.expenses.length,
      currencies: seed.currencies.length,
      debtors: seed.debtors.length,
      debts: seed.debts.length,
      budgets: seed.budgets.length,
    });
    expect(stats.expenses).toBe(20000);

    // Progress is reported per entity group, in write order, then commit.
    expect(phases).toEqual([
      'user',
      'categories',
      'debtors',
      'currencies',
      'expenses',
      'debts',
      'budgets',
      'writing',
      'committed',
    ]);
    batchSpy.mockRestore();
  });

  it('restores the 10k seed on top of the 20k one (wipe + recreate) and reports the time', async () => {
    const seed = loadSeed(10000);
    const t0 = performance.now();
    await importAllData(seed);
    console.log(`[L3] 10k restore over 20k rows (LokiJS): ${(performance.now() - t0).toFixed(0)} ms`);
    const counts = await countAll();
    expect(counts.expenses).toBe(10000);
    expect(counts.users).toBe(1);
  });

  it('yields to the event loop between groups so progress can paint', async () => {
    const seed = loadSeed(300);
    let ticks = 0;
    const interval = setInterval(() => {
      ticks++;
    }, 0);
    const ticksAtPhase: number[] = [];
    await importAllData(seed, () => {
      ticksAtPhase.push(ticks);
    });
    clearInterval(interval);
    // The interval must have fired between every two consecutive phases: a
    // synchronous import would report the same tick count for all of them.
    for (let i = 1; i < ticksAtPhase.length; i++) {
      expect(ticksAtPhase[i]).toBeGreaterThan(ticksAtPhase[i - 1] ?? Number.NaN);
    }
    expect(ticksAtPhase).toHaveLength(9);
  });
});
