/**
 * Plan P8's exit check on the 10k seed with positions (scripts/seed-backup.mjs
 * --accounts: Cash, a bank, a card, an investment; 200 transfers; 12
 * checkpoints), restored through the real import:
 *
 * - every account's balance equals the replay of every row (harness/positionsOracle);
 * - the articulation (R16) holds to the unit for every month of the five
 *   years and for the whole span;
 * - each checkpoint's stored gap is its true gap against the restored rows
 *   (the seed computes them from its own rows; the restore keeps them);
 * - money in, spent and kept per month do not depend on accounts at all, so
 *   Free and Pro read the same totals (L5): they equal the replay of every row.
 *
 * Real LokiJS database. Device timing is the Diagnostics screen's (P8 record).
 */
import {performance} from 'node:perf_hooks';
import type {ExportData} from '../../src/data/backup/export/format';
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {importAllData} from '../../src/data/services/importService';
import {database} from '../../src/data/database/database';
import {articulate, getNetWorth} from '../../src/data/services/netWorthService';
import {getMonthSummary} from '../../src/data/services/periodSummaryService';
import {shiftIsoDay} from '../../src/domain/dates';
import {oracleBalance, oracleKept, oracleNetWorth, readOracle} from '../harness/positionsOracle';
import {seedBackup, SEED_ANCHOR} from '../harness/seed';
import {deleteAllData} from '../../src/data/services/deleteService';
import {periodFor} from '../../src/domain/period';

const units = (amount: number) => Math.round(amount * 10_000);

const loadSeed = (): ExportData => {
  const validation = validateExportEnvelope(seedBackup(10000, {accounts: true}));
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'seed did not validate');
  }
  return upgradeExportData(validation.data);
};

/** Every 'YYYY-MM' from the seed's first month to its anchor's. */
const monthsOf = (first: string, last: string): string[] => {
  const months: string[] = [];
  for (let [y, m] = first.split('-').map(Number) as [number, number]; `${y}-${String(m).padStart(2, '0')}` <= last;) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return months;
};

const lastDayOf = (yearMonth: string): string => shiftIsoDay(`${shiftIsoDay(`${yearMonth}-28`, 4).slice(0, 7)}-01`, -1);

describe('positions on the 10k seed', () => {
  jest.setTimeout(240_000);
  let userId = '';

  beforeAll(async () => {
    await deleteAllData();
    const seed = loadSeed();
    expect(seed.transfers).toHaveLength(200);
    expect(seed.checkpoints).toHaveLength(12);
    expect(seed.accounts.map(a => a.type)).toEqual(['cash', 'bank', 'card', 'investment']);
    await importAllData(seed);
    const [user] = await database.get('users').query().fetch();
    userId = user?.id ?? '';
  });

  it('every balance equals the replay of every row, on the anchor day', async () => {
    const data = await readOracle();
    const t0 = performance.now();
    const worth = await getNetWorth(userId, SEED_ANCHOR);
    console.log(
      `[P8] net worth over ${worth.accounts.length} accounts (LokiJS): ${(performance.now() - t0).toFixed(0)} ms`,
    );
    for (const row of data.accounts) {
      expect(units(worth.accounts.find(a => a.accountId === row['id'])?.balance ?? NaN)).toBe(
        oracleBalance(data, row, SEED_ANCHOR),
      );
    }
    expect(units(worth.total)).toBe(oracleNetWorth(data, SEED_ANCHOR));
  });

  it('each checkpoint’s stored gap is its true gap against the restored rows', async () => {
    const data = await readOracle();
    for (const [, list] of data.checkpoints) {
      for (const checkpoint of list) {
        const account = data.accounts.find(a => a['id'] === checkpoint['account_id']);
        const day = String(checkpoint['date']);
        // The balance just before it: the same rows with this checkpoint and later ones left out.
        const without = {
          ...data,
          checkpoints: new Map(
            [...data.checkpoints].map(([id, cps]) => [
              id,
              cps.filter(
                c =>
                  c !== checkpoint &&
                  String(c['date']) <= day &&
                  Number(c['created_at']) <= Number(checkpoint['created_at']),
              ),
            ]),
          ),
        };
        expect(units(Number(checkpoint['balance'])) - oracleBalance(without, account!, day)).toBe(
          units(Number(checkpoint['gap'])),
        );
      }
    }
  });

  it('the articulation holds to the unit for every month, and for the five years', async () => {
    const data = await readOracle();
    const firstDay = [...data.flows.expenses.map(e => String(e['date']).slice(0, 10))].sort()[0] ?? SEED_ANCHOR;
    const months = monthsOf(firstDay.slice(0, 7), SEED_ANCHOR.slice(0, 7));
    expect(months.length).toBeGreaterThanOrEqual(60);
    let revaluations = 0;
    for (const month of months) {
      const to = month === SEED_ANCHOR.slice(0, 7) ? SEED_ANCHOR : lastDayOf(month);
      const result = await articulate(userId, `${month}-01`, to);
      expect({month, holds: result.holds}).toEqual({month, holds: true});
      const after = shiftIsoDay(`${month}-01`, -1);
      expect(units(result.netWorthChange)).toBe(oracleNetWorth(data, to) - oracleNetWorth(data, after));
      expect(units(result.kept)).toBe(oracleKept(data, after, to));
      revaluations += units(result.revaluations);
    }
    // The fund's eight statements are in it: something was revalued.
    expect(revaluations).not.toBe(0);
    const whole = await articulate(userId, firstDay, SEED_ANCHOR);
    expect(whole.holds).toBe(true);
    expect(whole.openings).toBe(25000 + 100000);
  });

  it('a month’s money in, spent and kept are the replay of every row, whatever account they are on (L5)', async () => {
    const data = await readOracle();
    for (const month of ['2022-01', '2024-06', '2026-10']) {
      const summary = await getMonthSummary(userId, periodFor(month));
      expect(units(summary.kept)).toBe(oracleKept(data, shiftIsoDay(`${month}-01`, -1), lastDayOf(month)));
    }
  });
});
