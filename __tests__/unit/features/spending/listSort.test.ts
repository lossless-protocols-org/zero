import {arrangeRows} from '../../../../src/features/spending/listSort';
import {flattenDayGroups} from '../../../../src/ui/groupExpensesByDay';

interface Row {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  date: string;
}

const NAMES: Record<string, string> = {food: 'Food', bus: 'Transport', fun: 'Éntertainment'};
const name = (r: Row): string => NAMES[r.categoryId] ?? '';
const rows: Row[] = [
  {id: 'a', title: 'chai', amount: 20, categoryId: 'food', date: '2026-11-06T08:00:00'},
  {id: 'b', title: 'Bus', amount: 15, categoryId: 'bus', date: '2026-11-05T09:00:00'},
  {id: 'c', title: 'Cinema', amount: 300, categoryId: 'fun', date: '2026-11-04T20:00:00'},
  {id: 'd', title: 'Ápple', amount: 120, categoryId: 'food', date: '2026-11-07T10:00:00'},
  {id: 'r', title: 'Cinema', amount: -100, categoryId: 'fun', date: '2026-11-07T11:00:00'}, // money back
];
const none = new Set<string>();
const ids = (items: ReturnType<typeof flattenDayGroups<Row>>): string[] =>
  items.map(i => (i.type === 'header' ? `[${i.label} ${i.total}]` : i.row.id));

describe('arrangeRows', () => {
  it('date: day sections newest first, as before', () => {
    expect(ids(flattenDayGroups(arrangeRows(rows, 'date', name), none, none))).toEqual([
      expect.stringMatching(/^\[.* 20\]$/), // 7 Nov: 120 − 100
      'r',
      'd',
      expect.stringMatching(/^\[/),
      'a',
      expect.stringMatching(/^\[/),
      'b',
      expect.stringMatching(/^\[/),
      'c',
    ]);
  });

  it('category: a section per category A → Z (accents ignored) with its net total, newest first inside', () => {
    expect(ids(flattenDayGroups(arrangeRows(rows, 'category', name), none, none))).toEqual([
      '[Éntertainment 200]',
      'r',
      'c',
      '[Food 140]',
      'd',
      'a',
      '[Transport 15]',
      'b',
    ]);
  });

  it('title: one list A → Z, case and accents ignored, newest first on a tie, no headers', () => {
    expect(ids(flattenDayGroups(arrangeRows(rows, 'title', name), none, none))).toEqual(['d', 'b', 'a', 'r', 'c']);
  });

  it('amount: largest first, money back last', () => {
    expect(ids(flattenDayGroups(arrangeRows(rows, 'amount', name), none, none))).toEqual(['c', 'd', 'a', 'b', 'r']);
  });

  it('outside date order each row shows its own day', () => {
    const items = flattenDayGroups(arrangeRows(rows, 'amount', name), none, none);
    const labels = items.flatMap(i => (i.type === 'row' ? [i.dayLabel] : []));
    expect(new Set(labels).size).toBe(4); // 4, 5, 6 and 7 Nov
  });
});
