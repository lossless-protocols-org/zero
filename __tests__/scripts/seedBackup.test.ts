/**
 * The seed generator (scripts/seed-backup.mjs) must produce a file the real
 * import path accepts: valid key, valid v5 envelope, every reference
 * resolvable by the planner, and a stable size per row so the 10k seed stays a
 * meaningful benchmark.
 */
import {isValidExportKey} from '../../src/data/backup/export/key';
import {validateExportEnvelope} from '../../src/data/backup/export/validate';
import {upgradeExportData} from '../../src/data/backup/export/upgrader';
import {buildImportPlan} from '../../src/data/backup/import/planner';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fromRoot} from '../harness/paths';
import {SEED_ANCHOR} from '../harness/seed';

const generate = (count: number, compact = false): string => {
  const dir = mkdtempSync(join(tmpdir(), 'zero-seed-'));
  const out = join(dir, `seed_${count}.json`);
  const args = [String(count), '--anchor', SEED_ANCHOR, '--out', out, ...(compact ? ['--compact'] : [])];
  execFileSync('node', [fromRoot('scripts', 'seed-backup.mjs'), ...args], {stdio: 'pipe'});
  return readFileSync(out, 'utf8');
};

describe('seed-backup.mjs', () => {
  const raw = generate(300);
  const parsed: unknown = JSON.parse(raw);

  it('writes a v5 envelope with a valid provenance key', () => {
    const validation = validateExportEnvelope(parsed);
    expect(validation.success).toBe(true);
    expect(validation.data?.version).toBe(5);
    expect(isValidExportKey(validation.data?.key)).toBe(true);
  });

  it('has the documented shape: n expenses, 16 + 2 categories, 5 debtors, one currency, two budgets', () => {
    const data = upgradeExportData(validateExportEnvelope(parsed).data!); // validated above — safe
    expect(data.expenses).toHaveLength(300);
    expect(data.categories.filter(c => c.kind === 'expense')).toHaveLength(16);
    // A Free user: one income category (domain/freeTier).
    expect(data.categories.filter(c => c.kind === 'income').map(c => c.name)).toEqual(['Income']);
    expect(data.debtors).toHaveLength(5);
    expect(data.currencies).toEqual([{code: 'INR', symbol: '₹', name: 'Indian Rupee'}]);
    expect(data.budgets).toHaveLength(2);
    expect(data.budgets.some(b => b.budgetType === 'category' && b.category?.name === 'Food')).toBe(true);
  });

  it('references only categories and debtors that exist, so nothing is auto-created on import', () => {
    const data = upgradeExportData(validateExportEnvelope(parsed).data!); // validated above — safe
    const plan = buildImportPlan(data);
    expect(plan.stats.autoCreatedCategories).toBe(0);
    expect(plan.stats.autoCreatedDebtors).toBe(0);
    expect(plan.budgets).toHaveLength(2);
    // v5: every refund fits its expense and every entry lands on the one default account.
    expect(plan.stats.rejectedRefunds).toBe(0);
    expect(plan.stats.reassignedToDefaultAccount).toBe(0);
    expect(plan.accounts).toEqual([expect.objectContaining({name: 'Cash', isDefault: true, currency: 'INR'})]);
  });

  it('v5: about one refund per 30 expenses, two incomes a month, timestamps from each date', () => {
    const data = upgradeExportData(validateExportEnvelope(parsed).data!); // validated above — safe
    const refunded = data.expenses.filter(e => (e.refunds?.length ?? 0) > 0);
    expect(refunded.length).toBeGreaterThan(0);
    expect(refunded.length).toBeLessThanOrEqual(10);
    for (const expense of refunded) {
      for (const refund of expense.refunds ?? []) {
        expect(refund.amount).toBeLessThan(expense.amount);
        expect(refund.date.slice(0, 10) >= expense.date.slice(0, 10)).toBe(true);
      }
    }
    // ~59 full months × 2, give or take the partial months at either end.
    expect(data.incomes.length).toBeGreaterThan(110);
    expect(data.incomes.every(i => /^\d{4}-\d{2}-\d{2}$/.test(i.date))).toBe(true);
    const first = data.expenses[0];
    expect(first?.createdAt).toBe(Date.parse(`${first?.date}Z`));
  });

  it('spreads dates over five years in the local ISO format the app writes', () => {
    const data = upgradeExportData(validateExportEnvelope(parsed).data!); // validated above — safe
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    const years = new Set<number>();
    for (const e of data.expenses) {
      expect(e.date).toMatch(iso);
      years.add(Number(e.date.slice(0, 4)));
    }
    expect(years.size).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for a given count', () => {
    expect(generate(50)).toBe(generate(50));
  });

  it('is pretty-printed by default (what the app writes) and compact on request', () => {
    const pretty = generate(100);
    const compact = generate(100, true);
    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(JSON.parse(pretty)).toEqual(JSON.parse(compact));
  });
});
