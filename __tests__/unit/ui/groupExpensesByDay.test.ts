/**
 * Characterization for S3 (v2.7.1). TransactionList used to group with
 * `formatDate(date, 'YYYY-MM-DD')` per row, order days with `new Date()` per
 * comparison, format `'Do MMM'` per row render, and receive its input from
 * `sortByDateDesc`, which ran two dayjs parses per comparison. The rewrite
 * groups by the string prefix, formats the label once per day, and sorts
 * strings. What the user sees must not change: the same days in the same
 * order, the same rows in the same order inside each day (time order, ties in
 * input order), and the same date label on every row. The reference below is
 * the pre-S3 code, copied verbatim.
 *
 * Tickets: S7.
 */
import {formatCalendar, formatDisplayDate} from '../../../src/platform/dateFormat';
import {formatDate, diffDates, sortByDateDesc, sortByDateAsc} from '../../../src/domain/dates';
import {flattenDayGroups, groupExpensesByDay} from '../../../src/ui/groupExpensesByDay';
import {performance} from 'node:perf_hooks';
import {seedBackup} from '../../harness/seed';

interface Row {
  id: string;
  date: string;
  amount: number;
}

// ---- pre-S3 reference (TransactionList.tsx:337-357, dateUtils.ts:259-263, row label :119) ----
const oldSortByDateDesc = <T extends {date: string}>(items: T[]): T[] =>
  [...items].sort((a, b) => diffDates(b.date, a.date));

const oldGroup = (allExpenses: Row[]) => {
  const groupedExpenses = new Map<string, Array<Row>>();
  allExpenses.forEach(expense => {
    const date = formatDate(expense.date, 'YYYY-MM-DD');
    const currentGroup = groupedExpenses.get(date) ?? [];
    currentGroup.push(expense);
    groupedExpenses.set(date, currentGroup);
  });
  const sortedDates = Array.from(groupedExpenses.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });
  return sortedDates.map(date => ({
    date,
    expenses: (groupedExpenses.get(date) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    label: formatCalendar(date),
  }));
};
// ---------------------------------------------------------------------------------------------

/** What reaches the screen: day key, day label, then each row's id and its date label. */
const oldView = (rows: Row[]) =>
  oldGroup(oldSortByDateDesc(rows)).map(g => ({
    date: g.date,
    label: g.label,
    // M32 swapped the label's English 'Do MMM' for the locale's day + month.
    rows: g.expenses.map(e => `${e.id}|${formatDisplayDate(e.date, 'dayMonth')}`),
  }));
const newView = (rows: Row[]) =>
  groupExpensesByDay(sortByDateDesc(rows)).map(g => ({
    date: g.date,
    label: g.label,
    rows: g.expenses.map(e => `${e.id}|${g.dayLabel}`),
  }));

const loadSeed = (): Row[] => {
  // The generator's shape (scripts/seed-backup.mjs); only these fields are read.
  const seed = seedBackup(10000) as {data: {expenses: Array<{date: string; amount: number}>}};
  return seed.data.expenses.map((e, i) => ({id: `e${i}`, date: e.date, amount: e.amount}));
};

describe('groupExpensesByDay + sortByDateDesc', () => {
  const all = loadSeed();
  const byMonth = new Map<string, Row[]>();
  for (const r of all) {
    const m = r.date.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), r]);
  }

  it('renders every month of the 10k seed exactly as before (days, labels, row order, row labels)', () => {
    expect(byMonth.size).toBeGreaterThanOrEqual(60);
    for (const rows of byMonth.values()) {
      expect(newView(rows)).toEqual(oldView(rows));
    }
  });

  it('renders the whole 10k list exactly as before', () => {
    expect(newView(all)).toEqual(oldView(all));
  });

  it('keeps same-day time order, same-second ties in input order, and odd stored formats on the right local day', () => {
    const tricky: Row[] = [
      {id: 'a', date: '2025-06-01T09:00:00', amount: 1},
      {id: 'b', date: '2025-06-01T23:59:59', amount: 1},
      {id: 'c', date: '2025-06-02T00:00:01', amount: 1}, // 2 s after b, next day
      {id: 'd', date: '2025-06-01T09:00:00', amount: 1}, // tie with a
      {id: 'e', date: '2025-06-01', amount: 1}, // date-only (old imports)
      {id: 'f', date: '2025-06-01T10:00:00.250', amount: 1}, // milliseconds
      {id: 'g', date: '2025-06-01T12:00:00Z', amount: 1}, // UTC: local day depends on TZ
      {id: 'h', date: '2025-05-31T22:30:00+05:30', amount: 1}, // offset
      {id: 'i', date: '2024-12-31T23:00:00', amount: 1},
      {id: 'j', date: '2025-01-01T01:00:00', amount: 1},
    ];
    expect(newView(tricky)).toEqual(oldView(tricky));
    // Reversed input exercises the tie and the comparator's direction.
    expect(newView([...tricky].reverse())).toEqual(oldView([...tricky].reverse()));
  });

  it('dates with out-of-range parts land on the same day dayjs always gave them (T24:00, Feb 30, month 13, leap days)', () => {
    const rolled: Row[] = [
      {id: 'a', date: '2026-10-25T24:00:00', amount: 1},
      {id: 'b', date: '2026-10-25T23:60', amount: 1},
      {id: 'c', date: '2026-02-30', amount: 1},
      {id: 'd', date: '2026-13-01', amount: 1},
      {id: 'e', date: '2026-04-31T10:00:00', amount: 1},
      {id: 'f', date: '2024-02-29T10:00:00', amount: 1}, // real leap day
      {id: 'g', date: '2025-02-29T10:00:00', amount: 1}, // not a leap year
      {id: 'h', date: '2026-03-02T08:00:00', amount: 1},
      {id: 'i', date: '2026-10-26T01:00:00', amount: 1},
    ];
    expect(newView(rolled)).toEqual(oldView(rolled));
  });

  it('puts rows without a real date last instead of above Today', () => {
    const rows: Row[] = [
      {id: 'old', date: '2025-06-01T10:00:00', amount: 1},
      {id: 'bad', date: 'garbage', amount: 1},
      {id: 'new', date: '2025-06-03T10:00:00', amount: 1},
    ];
    const groups = groupExpensesByDay(sortByDateDesc(rows));
    expect(groups.map(g => g.expenses.map(e => e.id))).toEqual([['new'], ['old'], ['bad']]);
    expect(sortByDateDesc(rows).map(r => r.id)).toEqual(['new', 'old', 'bad']);
    expect(sortByDateAsc(rows).map(r => r.id)).toEqual(['old', 'new', 'bad']);
    const withMissing = [{date: ''}, {date: '2025-06-01T10:00:00'}];
    expect(sortByDateDesc(withMissing).map(r => r.date)).toEqual(['2025-06-01T10:00:00', '']);
  });

  it('sortByDateDesc is a true timestamp order (the old day-granular diff treated b and c, 2 s apart across midnight, as equal)', () => {
    const rows: Row[] = [
      {id: 'b', date: '2025-06-01T23:59:59', amount: 1},
      {id: 'c', date: '2025-06-02T00:00:01', amount: 1},
      {id: 'a', date: '2025-06-01T09:00:00', amount: 1},
    ];
    expect(diffDates(rows[1]?.date, rows[0]?.date)).toBe(0); // documents the old comparator
    expect(sortByDateDesc(rows).map(r => r.id)).toEqual(['c', 'b', 'a']);
    expect(sortByDateAsc(rows).map(r => r.id)).toEqual(['a', 'b', 'c']);
    // Non-string inputs still sort by instant.
    const mixed = [{date: new Date(2025, 0, 2)}, {date: new Date(2025, 0, 3).getTime()}, {date: '2025-01-01T00:00:00'}];
    expect(sortByDateDesc(mixed).map(r => formatDate(r.date))).toEqual(['2025-01-03', '2025-01-02', '2025-01-01']);
  });

  it('timing on the largest month and the whole seed (informational)', () => {
    const biggest = [...byMonth.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const time = (fn: () => unknown, n: number): number => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        fn();
      }
      return (performance.now() - t0) / n;
    };
    const oldMonth = time(() => oldGroup(oldSortByDateDesc(biggest)), 20);
    const newMonth = time(() => groupExpensesByDay(sortByDateDesc(biggest)), 20);
    const oldAll = time(() => oldGroup(oldSortByDateDesc(all)), 2);
    const newAll = time(() => groupExpensesByDay(sortByDateDesc(all)), 2);
    console.log(
      `[S3] sort+group, ${biggest.length}-row month: ${oldMonth.toFixed(2)} → ${newMonth.toFixed(2)} ms; ` +
        `10k rows: ${oldAll.toFixed(1)} → ${newAll.toFixed(1)} ms`,
    );
  });
});

describe('flattenDayGroups', () => {
  const rows: Row[] = [
    {id: 'a', date: '2025-06-03T10:00:00', amount: 10},
    {id: 'b', date: '2025-06-03T09:00:00', amount: 5},
    {id: 'c', date: '2025-06-01T12:00:00', amount: 7},
    {id: 'd', date: '2025-06-02T12:00:00', amount: 1},
  ];
  const groups = groupExpensesByDay(rows);
  const none = new Set<string>();

  it('emits each day header followed by its rows, in the grouped order, with unique keys', () => {
    const items = flattenDayGroups(groups, none, none);
    expect(items.map(i => (i.type === 'header' ? `H ${i.date}` : `R ${i.row.id}`))).toEqual([
      'H 2025-06-03',
      'R a',
      'R b',
      'H 2025-06-02',
      'R d',
      'H 2025-06-01',
      'R c',
    ]);
    expect(new Set(items.map(i => i.key)).size).toBe(items.length);
  });

  it('header totals and labels match the group; each row carries its day label', () => {
    const items = flattenDayGroups(groups, none, none);
    const first = items[0];
    expect(first?.type === 'header' && first.total).toBe(15);
    expect(first?.type === 'header' && first.label).toBe(groups[0]?.label);
    for (const item of items) {
      if (item.type === 'row') {
        expect(item.dayLabel).toBe(groups.find(g => g.expenses.includes(item.row))?.dayLabel);
      }
    }
  });

  it('a row awaiting undo stays (as pending) but leaves its day total', () => {
    const items = flattenDayGroups(groups, new Set(['a']), none);
    const header = items[0];
    expect(header?.type === 'header' && header.total).toBe(5);
    const a = items.find(i => i.type === 'row' && i.row.id === 'a');
    expect(a?.type === 'row' && a.pending).toBe(true);
  });

  it('a committed row is removed, and a day left empty loses its header', () => {
    const items = flattenDayGroups(groups, none, new Set(['d']));
    expect(items.some(i => i.type === 'header' && i.date === '2025-06-02')).toBe(false);
    expect(items.some(i => i.type === 'row' && i.row.id === 'd')).toBe(false);
  });

  it('flags only the very first row (swipe tutorial target)', () => {
    const items = flattenDayGroups(groups, none, none);
    expect(items.filter(i => i.type === 'row' && i.isFirstRow).map(i => (i.type === 'row' ? i.row.id : ''))).toEqual([
      'a',
    ]);
    const afterRemoval = flattenDayGroups(groups, none, new Set(['a']));
    expect(
      afterRemoval.filter(i => i.type === 'row' && i.isFirstRow).map(i => (i.type === 'row' ? i.row.id : '')),
    ).toEqual(['b']);
  });
});
