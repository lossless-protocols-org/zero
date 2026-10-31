/**
 * The seed generator (scripts/seed-backup.mjs) must produce a file the real
 * import path accepts: valid key, valid v4 envelope, every reference
 * resolvable by the planner, and a stable size per row so the 10k seed stays a
 * meaningful benchmark.
 */
// Node built-ins via require, as the sibling service tests do: the project's
// tsconfig deliberately loads only jest's globals, not @types/node.
const {execFileSync} = require('child_process');
const {mkdtempSync, readFileSync} = require('fs');
const {tmpdir} = require('os');
const {join, resolve} = require('path');
import {isValidExportKey} from '../export/key';
import {validateExportEnvelope} from '../export/validate';
import {upgradeExportData} from '../export/upgrader';
import {buildImportPlan} from '../import/planner';

declare const __dirname: string;

const generate = (count: number, compact = false): string => {
  const dir = mkdtempSync(join(tmpdir(), 'zero-seed-'));
  const out = join(dir, `seed_${count}.json`);
  const script = resolve(__dirname, '../../../scripts/seed-backup.mjs');
  execFileSync('node', [script, String(count), '--out', out, ...(compact ? ['--compact'] : [])], {stdio: 'pipe'});
  return readFileSync(out, 'utf8');
};

describe('seed-backup.mjs', () => {
  const raw = generate(300);
  const parsed: unknown = JSON.parse(raw);

  it('writes a v4 envelope with a valid provenance key', () => {
    const validation = validateExportEnvelope(parsed);
    expect(validation.success).toBe(true);
    expect(validation.data?.version).toBe(4);
    expect(isValidExportKey(validation.data?.key)).toBe(true);
  });

  it('has the documented shape: n expenses, 16 categories, 5 debtors, one currency, two budgets', () => {
    const data = upgradeExportData(validateExportEnvelope(parsed).data!); // validated above — safe
    expect(data.expenses).toHaveLength(300);
    expect(data.categories).toHaveLength(16);
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
