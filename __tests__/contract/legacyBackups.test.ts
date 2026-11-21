/**
 * Every backup any version of zero ever wrote must restore into the current
 * schema with nothing lost or changed (2.8 Phase 1; owner, 2026-11-06: "all
 * the previous versioned exports should work properly with no mistakes"; 3.0:
 * a v1 export must import into v3 without a crash).
 *
 * For each file: validate → refuse nothing → upgrade → restore through the
 * real importService (LokiJS harness) → compare with figures computed from
 * the RAW FILE, not from the planner: entry counts, exact money totals per
 * category, debts, budgets, the user; then account specifics (one default
 * account; each entry on the account the file names, else the default;
 * timestamps from each date; no incomes, refunds, transfers or checkpoints
 * invented); every income category the file has, kept (3.0). Finally export
 * → restore → export must be identical, so a current file is a fixed point.
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
    incomes?: Array<{amount: number; category: {name: string}; account?: string}>;
    debts: Array<{account?: string}>;
    accounts?: Array<{name: string; isDefault: boolean}>;
    transfers?: Array<{amount: number; fromAccount: string; toAccount: string}>;
    checkpoints?: Array<{balance: number; account: string}>;
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
    | 'is_default'
    | 'balance',
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

describe('every backup ever written restores into the current schema unchanged', () => {
  jest.setTimeout(300_000);

  it('has a fixture for every export version (v0 unversioned through the current one)', () => {
    const versions = files
      .filter(f => f.includes(`${path.sep}fixtures${path.sep}`))
      .map(f => (JSON.parse(fs.readFileSync(f, 'utf8')) as RawFile).version ?? 0)
      .sort();
    expect(versions).toEqual(Array.from({length: CURRENT_EXPORT_VERSION + 1}, (_, version) => version));
  });

  it.each(files.map(f => [path.basename(f), f] as const))('%s', async (_name, file) => {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawFile; // a backup file: shape checked by validate below
    await restore(raw);

    const [users, categories, expenses, debts, budgets, accounts, refunds, incomes, transfers, checkpoints] =
      await Promise.all([
        rows('users'),
        rows('categories'),
        rows('expenses'),
        rows('debts'),
        rows('budgets'),
        rows('accounts'),
        rows('refunds'),
        rows('incomes'),
        rows('transfers'),
        rows('checkpoints'),
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

    // Accounts: the file's (one of them the default), else one default 'Cash'. Every expense on
    // the account it names, else on the default.
    const fileAccounts = raw.data.accounts ?? [];
    const defaultName = fileAccounts.find(a => a.isDefault)?.name ?? 'Cash';
    expect(accounts.filter(a => a.is_default).map(a => a.name)).toEqual([defaultName]);
    // Plus any account a transfer, checkpoint or debt names that the list left out: made, not lost.
    const namedByV6 = [
      ...(raw.data.transfers ?? []).flatMap(t => [t.fromAccount, t.toAccount]),
      ...(raw.data.checkpoints ?? []).map(c => c.account),
      ...raw.data.debts.flatMap(d => (d.account === undefined ? [] : [d.account])),
    ];
    const listed = fileAccounts.length > 0 ? fileAccounts.map(a => a.name) : ['Cash'];
    expect(accounts.map(a => String(a.name)).sort()).toEqual([...new Set([...listed, ...namedByV6])].sort());
    const accountNameById = new Map(accounts.map(a => [a.id, String(a.name)]));
    const accountOfExpense = (e: (typeof expenses)[number]): string => String(accountNameById.get(e.account_id));
    const fileAccountByTitle = raw.data.expenses.map(e => (e as {account?: string}).account ?? defaultName).sort();
    expect(expenses.map(accountOfExpense).sort()).toEqual(fileAccountByTitle);
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

    // Every income category kept (3.0; 2.8 merged extras into one), each entry on its own.
    const fileIncomeCategories = new Set([
      ...raw.data.categories.filter(c => c.kind === 'income').map(c => c.name),
      ...fileIncomes.map(i => i.category.name),
    ]);
    const restoredIncomeCategories = categories.filter(c => c.kind === 'income').map(c => String(c.name));
    for (const name of fileIncomeCategories) {
      expect({name, kept: restoredIncomeCategories.includes(name)}).toEqual({name, kept: true});
    }
    const incomeTotals = (list: ReadonlyArray<{name: string; amount: number}>) =>
      list.reduce<Record<string, number>>((byName, {name, amount}) => {
        byName[name] = (byName[name] ?? 0) + toMoneyUnits(amount);
        return byName;
      }, {});
    expect(
      incomeTotals(incomes.map(i => ({name: String(nameById.get(i.category_id)), amount: Number(i.amount)}))),
    ).toEqual(incomeTotals(fileIncomes.map(i => ({name: i.category.name, amount: i.amount}))));

    // v6 positions: as many as the file holds, to the paisa, and debts on the account they name.
    // A transfer from an account to itself moves nothing and is left out (and said so).
    const fileTransfers = (raw.data.transfers ?? []).filter(t => t.fromAccount !== t.toAccount);
    const fileCheckpoints = raw.data.checkpoints ?? [];
    expect(transfers).toHaveLength(fileTransfers.length);
    expect(units(transfers)).toBe(units(fileTransfers));
    expect(checkpoints).toHaveLength(fileCheckpoints.length);
    expect(checkpoints.map(c => toMoneyUnits(Number(c.balance))).sort()).toEqual(
      fileCheckpoints.map(c => toMoneyUnits(c.balance)).sort(),
    );
    expect(debts.map(d => (d.account_id ? String(accountNameById.get(d.account_id)) : null)).sort()).toEqual(
      raw.data.debts.map(d => d.account ?? null).sort(),
    );

    // The current format is a fixed point: export → restore → export is identical.
    const first = await exportNow();
    await restore(JSON.parse(JSON.stringify(first)));
    const second = await exportNow();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
