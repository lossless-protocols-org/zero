import {budgetAppliesTo, encodeBudgetMonth, parseBudgetMonth, resolveBudget} from '../budgetMath';

const row = (id: string, month: string, amount: number) => ({id, monthKey: parseBudgetMonth(month), amount});
const applies = (month: string, yearMonth: string) => budgetAppliesTo(parseBudgetMonth(month), yearMonth);

describe('recurring month keys', () => {
  it('parses the three stored forms into one key type (M16)', () => {
    expect(parseBudgetMonth('2026-07')).toEqual({kind: 'month', yearMonth: '2026-07'});
    expect(parseBudgetMonth('recurring:2026-07')).toEqual({kind: 'recurring', start: '2026-07'});
    expect(parseBudgetMonth('recurring')).toEqual({kind: 'recurring', start: ''});
  });

  it('encodes a key back to exactly what was stored', () => {
    for (const stored of ['2026-07', 'recurring:2026-07', 'recurring']) {
      expect(encodeBudgetMonth(parseBudgetMonth(stored))).toBe(stored);
    }
  });

  it('applies recurring rows from their start month onward only', () => {
    expect(applies('recurring:2026-07', '2026-06')).toBe(false);
    expect(applies('recurring:2026-07', '2026-07')).toBe(true);
    expect(applies('recurring:2026-07', '2027-01')).toBe(true);
    expect(applies('recurring', '2020-01')).toBe(true);
    expect(applies('2026-07', '2026-08')).toBe(false);
  });
});

describe('resolveBudget', () => {
  it('returns null with no rows', () => {
    expect(resolveBudget([], '2026-10')).toBeNull();
  });

  it('prefers the month-specific row over any recurring row', () => {
    const rows = [row('r', 'recurring:2026-01', 10000), row('s', '2026-10', 7000)];
    expect(resolveBudget(rows, '2026-10')?.id).toBe('s');
    expect(resolveBudget(rows, '2026-09')?.id).toBe('r');
  });

  it('keeps earlier months on the older recurring amount when a later start is added', () => {
    // This is B3: "set 15k from October" used to overwrite July–September.
    const rows = [row('jul', 'recurring:2026-07', 10000), row('oct', 'recurring:2026-10', 15000)];
    expect(resolveBudget(rows, '2026-06')).toBeNull();
    expect(resolveBudget(rows, '2026-07')?.amount).toBe(10000);
    expect(resolveBudget(rows, '2026-09')?.amount).toBe(10000);
    expect(resolveBudget(rows, '2026-10')?.amount).toBe(15000);
    expect(resolveBudget(rows, '2027-03')?.amount).toBe(15000);
  });

  it('treats a 0-amount month row as "no budget this month" (tombstone)', () => {
    const rows = [row('r', 'recurring:2026-01', 10000), row('t', '2026-10', 0)];
    expect(resolveBudget(rows, '2026-10')).toBeNull();
    expect(resolveBudget(rows, '2026-11')?.amount).toBe(10000);
  });

  it('treats a 0-amount recurring row as a stop marker from its start month on', () => {
    const rows = [row('r', 'recurring:2026-01', 10000), row('stop', 'recurring:2026-10', 0)];
    expect(resolveBudget(rows, '2026-09')?.amount).toBe(10000);
    expect(resolveBudget(rows, '2026-10')).toBeNull();
    expect(resolveBudget(rows, '2027-01')).toBeNull();
  });

  it('legacy "recurring" rows lose to any dated recurring row that applies', () => {
    const rows = [row('legacy', 'recurring', 5000), row('dated', 'recurring:2026-05', 8000)];
    expect(resolveBudget(rows, '2026-04')?.id).toBe('legacy');
    expect(resolveBudget(rows, '2026-05')?.id).toBe('dated');
  });

  it('is order-independent', () => {
    const a = [row('oct', 'recurring:2026-10', 15000), row('jul', 'recurring:2026-07', 10000)];
    const b = [...a].reverse();
    expect(resolveBudget(a, '2026-08')?.id).toBe('jul');
    expect(resolveBudget(b, '2026-08')?.id).toBe('jul');
  });
});
