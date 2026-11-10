import {createMmkvPreference, oneOf} from '../../platform/mmkvPreference';
import {formatDisplayDate} from '../../platform/dateFormat';
import {toDayKey} from '../../domain/dates';
import {groupExpensesByDay, type DayGroup} from '../../ui/groupExpensesByDay';

/**
 * How a spending list is arranged (2.8, bug sheet #2: "sort by category,
 * description and title"). One choice for Home and the day screen, kept
 * across launches.
 *   date      day sections, newest first (the default, as before)
 *   category  a section per category with its net total, A → Z, newest first inside
 *   title     one list, A → Z (accents and case ignored), newest first on a tie
 *   amount    one list, largest first; money back (negative rows) last
 * Outside date order each row carries its own date ("6 Nov").
 */
export type ListSort = 'date' | 'category' | 'title' | 'amount';

export const LIST_SORTS: readonly ListSort[] = ['date', 'category', 'title', 'amount'];

export const listSortPreference = createMmkvPreference<ListSort>('listSort', oneOf(LIST_SORTS), 'date');

/** What arrangeRows reads from a row. */
interface SortableRow {
  id: string | number;
  date: string;
  amount: number;
  title: string;
  categoryId?: string;
}

/**
 * A text's sort key: lower case, accents dropped, outer spaces trimmed.
 * Compared by code unit, which is fast and the same on every engine (Hermes
 * routes Intl collation to Java's Collator on Android, slow per comparison).
 */
const textKey = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** Newest first, by the stored string (ISO sorts as time). */
const newestFirst = (a: SortableRow, b: SortableRow): number => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/** A row's own "6 Nov", formatted once per day however many rows share it. */
const dayLabels = (): ((row: SortableRow) => string) => {
  const cache = new Map<string, string>();
  return row => {
    const day = toDayKey(row.date);
    let label = cache.get(day);
    if (label === undefined) {
      label = formatDisplayDate(day, 'dayMonth');
      cache.set(day, label);
    }
    return label;
  };
};

/**
 * The list's groups for `sort` (TransactionList → flattenDayGroups).
 * `categoryName` names a row's category as the list shows it (translated).
 */
export const arrangeRows = <T extends SortableRow>(
  rows: readonly T[],
  sort: ListSort,
  categoryName: (row: T) => string,
): DayGroup<T>[] => {
  if (sort === 'date') {
    return groupExpensesByDay(rows);
  }
  const dayLabelOf = dayLabels();

  if (sort === 'category') {
    const groups = new Map<string, {name: string; key: string; rows: T[]}>();
    for (const row of rows) {
      const name = categoryName(row);
      const id = row.categoryId ?? name;
      const group = groups.get(id);
      if (group) {
        group.rows.push(row);
      } else {
        groups.set(id, {name, key: textKey(name), rows: [row]});
      }
    }
    return [...groups.entries()]
      .sort(([, a], [, b]) => byText(a.key, b.key))
      .map(([id, group]) => ({
        date: `category:${id}`,
        label: group.name,
        dayLabel: '',
        dayLabelOf,
        expenses: group.rows.sort(newestFirst),
      }));
  }

  const keyed = rows.map(row => ({row, key: textKey(row.title)}));
  keyed.sort((a, b) =>
    sort === 'title'
      ? byText(a.key, b.key) || newestFirst(a.row, b.row)
      : b.row.amount - a.row.amount || newestFirst(a.row, b.row),
  );
  return [
    {date: `sorted:${sort}`, label: '', dayLabel: '', dayLabelOf, headerless: true, expenses: keyed.map(k => k.row)},
  ];
};
