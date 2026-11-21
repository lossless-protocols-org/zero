/**
 * Positions (R8, R15, R16): an account's balance on a day, the four net-worth
 * lines, and the movement split that the articulation adds up. Checked case
 * by case, then against a replay (a different way of reading the same rules:
 * walk the account's history in order and keep a running balance) on random
 * histories.
 */
import fc from 'fast-check';
import {
  anchorOn,
  articulationOf,
  balanceOn,
  compareCheckpoints,
  effectiveGap,
  linesOf,
  movementOf,
  netWorthOf,
  openingBetween,
  type CheckpointPoint,
  type FlowsBetween,
  type Opening,
} from '../../../src/domain/positions';

interface Row {
  day: string;
  units: number;
}

const flowsOf =
  (rows: readonly Row[]): FlowsBetween =>
  (after, upTo) =>
    rows.filter(row => (after === null || row.day > after) && row.day <= upTo).reduce((sum, row) => sum + row.units, 0);

const cp = (date: string, balanceUnits: number, createdAt = 0, id = `${date}-${createdAt}`): CheckpointPoint => ({
  id,
  date,
  balanceUnits,
  createdAt,
  kind: 'adjustment',
});

/** The replay: events in order, a running balance; a checkpoint at the end of its day replaces it. */
const replay = (rows: readonly Row[], checkpoints: readonly CheckpointPoint[], opening: Opening, asOf: string) => {
  const days = [...new Set([...rows.map(r => r.day), ...checkpoints.map(c => c.date)])].filter(d => d <= asOf).sort();
  let running = opening.date === null ? opening.units : 0;
  let openingDone = opening.date === null;
  for (const day of days) {
    if (!openingDone && opening.date !== null && opening.date <= day) {
      running += opening.units;
      openingDone = true;
    }
    running += rows.filter(r => r.day === day).reduce((s, r) => s + r.units, 0);
    const ofDay = checkpoints.filter(c => c.date === day).sort(compareCheckpoints);
    const last = ofDay[ofDay.length - 1];
    if (last) {
      running = last.balanceUnits;
    }
  }
  if (!openingDone && opening.date !== null && opening.date <= asOf) {
    running += opening.units;
  }
  return running;
};

describe('balanceOn', () => {
  const rows: Row[] = [
    {day: '2026-10-30', units: -100},
    {day: '2026-11-01', units: 500},
    {day: '2026-11-03', units: -50},
  ];

  it('without a checkpoint: the opening balance plus every row up to the day', () => {
    expect(balanceOn([], {units: 1000, date: null}, flowsOf(rows), '2026-11-02')).toBe(1400);
    expect(balanceOn([], {units: 1000, date: null}, flowsOf(rows), '2026-11-30')).toBe(1350);
  });

  it('an opening balance counts from its own day, not before', () => {
    const opening = {units: 1000, date: '2026-11-01'};
    expect(balanceOn([], opening, flowsOf(rows), '2026-10-31')).toBe(-100);
    expect(balanceOn([], opening, flowsOf(rows), '2026-11-01')).toBe(1400);
  });

  it('a checkpoint is the balance at the end of its day: rows that day and before it no longer count', () => {
    const ordered = [cp('2026-11-01', 2000)];
    expect(balanceOn(ordered, {units: 1000, date: null}, flowsOf(rows), '2026-11-01')).toBe(2000);
    expect(balanceOn(ordered, {units: 1000, date: null}, flowsOf(rows), '2026-11-03')).toBe(1950);
    // Before it, the checkpoint does not exist yet.
    expect(balanceOn(ordered, {units: 1000, date: null}, flowsOf(rows), '2026-10-31')).toBe(900);
  });

  it('two checkpoints on one day: the one made last is the anchor', () => {
    const ordered = [cp('2026-11-01', 2000, 1), cp('2026-11-01', 3000, 2)].sort(compareCheckpoints);
    expect(anchorOn(ordered, '2026-11-01')?.balanceUnits).toBe(3000);
    expect(balanceOn(ordered, {units: 0, date: null}, flowsOf(rows), '2026-11-03')).toBe(2950);
  });

  it('an opening balance dated after the anchor is still brought in on its day', () => {
    const ordered = [cp('2026-10-30', 0)];
    expect(balanceOn(ordered, {units: 700, date: '2026-11-02'}, flowsOf(rows), '2026-11-01')).toBe(500);
    expect(balanceOn(ordered, {units: 700, date: '2026-11-02'}, flowsOf(rows), '2026-11-02')).toBe(1200);
  });

  it('agrees with the replay on random histories', () => {
    const day = fc.integer({min: 1, max: 20}).map(d => `2026-11-${String(d).padStart(2, '0')}`);
    fc.assert(
      fc.property(
        fc.array(fc.record({day, units: fc.integer({min: -1e9, max: 1e9})}), {maxLength: 30}),
        fc.array(fc.record({date: day, balanceUnits: fc.integer({min: -1e9, max: 1e9}), createdAt: fc.nat(5)}), {
          maxLength: 5,
        }),
        fc.record({units: fc.integer({min: -1e9, max: 1e9}), date: fc.option(day, {nil: null})}),
        day,
        (history, rawCheckpoints, opening, asOf) => {
          const ordered = rawCheckpoints
            .map((c, i) => cp(c.date, c.balanceUnits, c.createdAt, `c${i}`))
            .sort(compareCheckpoints);
          expect(balanceOn(ordered, opening, flowsOf(history), asOf)).toBe(replay(history, ordered, opening, asOf));
        },
      ),
      {numRuns: 500},
    );
  });
});

describe('openingBetween', () => {
  it('an undated opening belongs to the beginning only', () => {
    expect(openingBetween({units: 5, date: null}, null, '2026-11-01')).toBe(5);
    expect(openingBetween({units: 5, date: null}, '2026-10-01', '2026-11-01')).toBe(0);
  });
  it('a dated one counts in the range that holds its day', () => {
    expect(openingBetween({units: 5, date: '2026-11-01'}, '2026-10-31', '2026-11-01')).toBe(5);
    expect(openingBetween({units: 5, date: '2026-11-01'}, '2026-11-01', '2026-11-02')).toBe(0);
    expect(openingBetween({units: 5, date: '2026-11-01'}, null, '2026-10-31')).toBe(0);
  });
});

describe('effectiveGap', () => {
  it('is the gap shown on accepting, and follows a later backdated entry', () => {
    const opening = {units: 0, date: null};
    const ordered = [cp('2026-11-05', 1000)];
    expect(effectiveGap(ordered, 0, opening, flowsOf([{day: '2026-11-01', units: 900}]))).toBe(100);
    // An expense of 40 is added on the 3rd, after reconciling: the checkpoint now explains 140.
    const later = flowsOf([
      {day: '2026-11-01', units: 900},
      {day: '2026-11-03', units: -40},
    ]);
    expect(effectiveGap(ordered, 0, opening, later)).toBe(140);
    expect(effectiveGap(ordered, 7, opening, later)).toBe(0);
  });
});

describe('movementOf: end − start is exactly flows + opening + gaps', () => {
  const day = fc.integer({min: 1, max: 28}).map(d => `2026-11-${String(d).padStart(2, '0')}`);
  it('on random histories and periods', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({day, units: fc.integer({min: -1e9, max: 1e9})}), {maxLength: 30}),
        fc.array(
          fc.record({
            date: day,
            balanceUnits: fc.integer({min: -1e9, max: 1e9}),
            createdAt: fc.nat(5),
            kind: fc.constantFrom('revaluation' as const, 'adjustment' as const),
          }),
          {maxLength: 6},
        ),
        fc.record({units: fc.integer({min: -1e9, max: 1e9}), date: fc.option(day, {nil: null})}),
        day,
        day,
        (rows, raw, opening, a, b) => {
          const [after, upTo] = a <= b ? [a, b] : [b, a];
          const ordered = raw
            .map((c, i) => ({...cp(c.date, c.balanceUnits, c.createdAt, `c${i}`), kind: c.kind}))
            .sort(compareCheckpoints);
          const m = movementOf(ordered, opening, flowsOf(rows), after, upTo);
          expect(m.end - m.start).toBe(m.flows + m.opening + m.revaluations + m.adjustments);
          expect(m.end).toBe(replay(rows, ordered, opening, upTo));
          expect(m.start).toBe(replay(rows, ordered, opening, after));
        },
      ),
      {numRuns: 500},
    );
  });
});

describe('net worth lines', () => {
  it('cards and loans below zero are what you owe; overpaid, the lender owes you; an overdraft is your own balance', () => {
    const lines = linesOf(
      [
        {type: 'bank', balanceUnits: 5000},
        {type: 'bank', balanceUnits: -200},
        {type: 'card', balanceUnits: -1500},
        {type: 'card', balanceUnits: 300},
        {type: 'loan', balanceUnits: -2500},
        {type: 'investment', balanceUnits: 9000},
      ],
      [400, -700, 0],
    );
    // In hand 5000 − 200; the overpaid card's 300 is owed to you, never in hand (approved model A2).
    expect(lines).toEqual({cashAndBank: 4800, investments: 9000, owedToYou: 1000, youOwe: 4400});
    expect(netWorthOf(lines)).toBe(4800 + 9000 + 1000 - 4400);
  });

  it('net worth is Σ balances − net debt, whatever the split', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom(
              'cash' as const,
              'bank' as const,
              'card' as const,
              'investment' as const,
              'other' as const,
            ),
            balanceUnits: fc.integer({min: -1e9, max: 1e9}),
          }),
        ),
        fc.array(fc.integer({min: -1e9, max: 1e9})),
        (accounts, debts) => {
          const total = accounts.reduce((s, a) => s + a.balanceUnits, 0) - debts.reduce((s, d) => s + d, 0);
          expect(netWorthOf(linesOf(accounts, debts))).toBe(total);
        },
      ),
    );
  });
});

describe('articulationOf', () => {
  it('holds only on exact equality', () => {
    const parts = {kept: 100, revaluations: 20, adjustments: -5, openings: 0, debtsOutsideAccounts: 10};
    expect(articulationOf({...parts, netWorthChange: 125}).holds).toBe(true);
    expect(articulationOf({...parts, netWorthChange: 124}).holds).toBe(false);
  });
});
