/**
 * Every backup any version of zero ever wrote must restore into schema v5
 * with nothing lost or changed (2.8 Phase 1; owner, 2026-11-06: "all the
 * previous versioned exports should work properly with no mistakes").
 *
 * For each file: validate → refuse nothing → upgrade → restore through the
 * real importService (LokiJS harness) → compare with figures computed from
 * the RAW FILE, not from the planner: entry counts, exact money totals per
 * category, debts, budgets, the user; then v5 specifics (one default account
 * holding every expense, timestamps from each date, no incomes or refunds
 * invented). Finally export → restore → export must be identical, so a v5
 * file is a fixed point.
 *
 * Files: the committed synthetic set in __tests__/contract/fixtures/legacy (one per
 * export version, each with that version's known quirks), plus, when
 * ZERO_LEGACY_DIR points at a folder, every real backup in it (personal data
 * stays out of the repo).
 */
import type {ExportData} from '../../src/data/backup/export/format';
import {database} from '../../src/data/database/database';
import {importAllData} from '../../src/data/services/importService';
import {getAllData} from '../../src/data/services/getService';
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {isEnvelopeTooNew, CURRENT_EXPORT_VERSION} from '../../src/data/backup/export/format';
import {isValidExportKey} from '../../src/data/backup/export/key';
import {epochFromIsoDate} from '../../src/domain/isoEpoch';
import {toMoneyUnits} from '../../src/domain/money';
import fs from 'node:fs';
import path from 'node:path';

interface RawFile {
  key: string;
  version?: number;
  data: {
    users: Array<{username: string}>;
    categories: Array<{name: string; kind?: 'expense' | 'income'}>;
    expenses: Array<{
      amount: number;
      category: {name: string};
      date: string;
      createdAt?: number;
      refunds?: Array<{amount: number}>;
    }>;
    incomes?: Array<{amount: number; category: {name: string}}>;
    debts: unknown[];
    budgets?: Array<{month: string; budgetType: string; category?: {name: string}}>;
  };
}

/** The raw columns this test reads (unsafeFetchRaw rows). */
type Row = Partial<
  Record<
    | 'id'
    | 'username'
    | 'name'
    | 'kind'
    | 'category_id'
    | 'amount'
    | 'account_id'
    | 'created_at'
    | 'date'
    | 'is_default',
    unknown
  >
>;

const listJson = (dir: string): string[] =>
  fs.existsSync(dir)
    ? (fs.readdirSync(dir) as string[]).filter(f => f.endsWith('.json')).map(f => path.join(dir, f))
    : [];

const files = [
  ...listJson(path.join(__dirname, 'fixtures', 'legacy')), // beside this file
  ...(process.env['ZERO_LEGACY_DIR'] ? listJson(process.env['ZERO_LEGACY_DIR']) : []),
];

const rows = async (table: string): Promise<Row[]> => database.get(table).query().unsafeFetchRaw();

/** Exact money per category name, from the raw file. */
const totalsByCategory = (expenses: RawFile['data']['expenses']): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    out[e.category.name] = (out[e.category.name] ?? 0) + toMoneyUnits(e.amount);
  }
  return out;
};

/** Budgets a restore keeps: unique (month, type, category); a category budget needs its category in the file. */
const expectedBudgets = (raw: RawFile['data']): number => {
  const names = new Set(raw.categories.map(c => c.name));
  const keys = new Set<string>();
  for (const b of raw.budgets ?? []) {
    const category = b.budgetType === 'category' ? b.category?.name : undefined;
    if (b.budgetType === 'category' && (!category || !names.has(category))) {
      continue;
    }
    keys.add(`${b.month}|${b.budgetType}|${category ?? ''}`);
  }
  return keys.size;
};

const restore = async (json: unknown): Promise<ExportData> => {
  const validation = validateExportEnvelope(json);
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'did not validate');
  }
  expect(isValidExportKey(validation.data.key)).toBe(true);
  expect(isEnvelopeTooNew(validation.data.version)).toBe(false);
  const data = upgradeExportData(validation.data);
  await importAllData(data);
  return data;
};

const exportNow = async (): Promise<unknown> => {
  const draft = await getAllData();
  if (!draft) {
    throw new Error('export failed');
  }
  return {key: 'zeroAAAAAAAAAAAAAAAA', version: CURRENT_EXPORT_VERSION, data: draft};
};

describe('every backup ever written restores into schema v5 unchanged', () => {
  jest.setTimeout(300_000);

  it('has a fixture for every export version (v0 unversioned through v4)', () => {
    const versions = files
      .filter(f => f.includes(`${path.sep}fixtures${path.sep}`))
      .map(f => (JSON.parse(fs.readFileSync(f, 'utf8')) as RawFile).version ?? 0)
      .sort();
    expect(versions).toEqual([0, 1, 2, 3, 4]);
  });

  it.each(files.map(f => [path.basename(f), f] as const))('%s', async (_name, file) => {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawFile; // a backup file: shape checked by validate below
    await restore(raw);

    const [users, categories, expenses, debts, budgets, accounts, refunds, incomes] = await Promise.all([
      rows('users'),
      rows('categories'),
      rows('expenses'),
      rows('debts'),
      rows('budgets'),
      rows('accounts'),
      rows('refunds'),
      rows('incomes'),
    ]);

    // Nothing lost.
    expect(users.map(u => u.username)).toEqual([raw.data.users[0]?.username]);
    expect(expenses).toHaveLength(raw.data.expenses.length);
    expect(debts).toHaveLength(raw.data.debts.length);
    expect(budgets).toHaveLength(expectedBudgets(raw.data));

    // Nothing changed: exact money per category, by name.
    const nameById = new Map(categories.map(c => [c.id, c.name]));
    const restored: Record<string, number> = {};
    for (const e of expenses) {
      const name = String(nameById.get(e.category_id));
      restored[name] = (restored[name] ?? 0) + toMoneyUnits(Number(e.amount));
    }
    expect(restored).toEqual(totalsByCategory(raw.data.expenses));

    // Every category the file names exists under its own kind (files before v5 hold expense categories only).
    const restoredKeys = new Set(categories.map(c => `${String(c.kind)}:${String(c.name)}`));
    const fileKeys = [
      ...raw.data.categories.map(c => `${c.kind ?? 'expense'}:${c.name}`),
      ...raw.data.expenses.map(e => `expense:${e.category.name}`),
      ...(raw.data.incomes ?? []).map(i => `income:${i.category.name}`),
    ];
    for (const key of fileKeys) {
      expect({key, present: restoredKeys.has(key)}).toEqual({key, present: true});
    }

    // v5: one default account holds every expense; timestamps come from each date; nothing invented.
    expect(accounts.map(a => [a.is_default, a.name])).toEqual([[true, 'Cash']]);
    const accountId = accounts[0]?.id;
    expect(expenses.every(e => e.account_id === accountId)).toBe(true);
    // A file's own timestamp is kept; only a file without one gets it from the date.
    const expectedStamps = raw.data.expenses.map(e => e.createdAt ?? epochFromIsoDate(e.date)).sort();
    expect(expenses.map(e => Number(e.created_at)).sort()).toEqual(expectedStamps);
    // Refunds and money in: as many as the file holds, to the paisa (none in files before v5).
    const fileRefunds = raw.data.expenses.flatMap(e => e.refunds ?? []);
    const fileIncomes = raw.data.incomes ?? [];
    const units = (list: ReadonlyArray<{amount?: unknown}>): number =>
      list.reduce((sum: number, r) => sum + toMoneyUnits(Number(r.amount)), 0);
    expect(refunds).toHaveLength(fileRefunds.length);
    expect(units(refunds)).toBe(units(fileRefunds));
    expect(incomes).toHaveLength(fileIncomes.length);
    expect(units(incomes)).toBe(units(fileIncomes));

    // v5 is a fixed point: export → restore → export is identical.
    const first = await exportNow();
    await restore(JSON.parse(JSON.stringify(first)));
    const second = await exportNow();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
