import {compareDateKeys, toDayKey} from '../domain/dates';
import {formatCalendar, formatDisplayDate} from '../platform/dateFormat';
import {fromMoneyUnits, toMoneyUnits} from '../domain/money';

export interface DayGroup<T> {
  /** Local calendar day, `YYYY-MM-DD`; any unique key for a group that is not a day (listSort). */
  date: string;
  /** Rows of that day, newest first by their stored string (as before S3); ties keep input order. */
  expenses: T[];
  /** Section header: "Today", "Yesterday", a weekday or a full date. */
  label: string;
  /** The `Do MMM` shown on every row of the day, formatted once per day. */
  dayLabel: string;
  /** Rows from many days (listSort): each row's own `Do MMM`, used instead of `dayLabel`. */
  dayLabelOf?: (row: T) => string;
  /** One sorted list with no section header (listSort: title, amount). */
  headerless?: boolean;
}

/**
 * Groups rows into days for TransactionList (S3, v2.7.1). Days come out
 * newest first, with a day that is not a real date ("Invalid Date" from a bad
 * import) last. Dates are grouped by their string prefix and compared as
 * strings, so a month costs two dayjs calls per day (the two labels) instead
 * of several per row.
 */
export const groupExpensesByDay = <T extends {date: string}>(rows: readonly T[]): DayGroup<T>[] => {
  const byDay = new Map<string, T[]>();
  for (const row of rows) {
    const day = toDayKey(row.date);
    const group = byDay.get(day);
    if (group) {
      group.push(row);
    } else {
      byDay.set(day, [row]);
    }
  }
  return Array.from(byDay.keys())
    .sort((a, b) => compareDateKeys(a, b, -1))
    .map(date => ({
      date,
      expenses: (byDay.get(date) ?? []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      label: formatCalendar(date),
      dayLabel: formatDisplayDate(date, 'dayMonth'),
    }));
};

export type DayListItem<T> =
  | {type: 'header'; key: string; date: string; label: string; total: number}
  | {type: 'row'; key: string; row: T; dayLabel: string; pending: boolean; isFirstRow: boolean};

/**
 * One flat list for FlashList (S7, v2.7.1): a header item per day followed by
 * its rows, so the list recycles rows instead of whole days. `pendingIds` are
 * rows awaiting undo (shown as deleted, excluded from the day total);
 * `removedIds` are rows already deleted but not yet refetched (hidden; a day
 * left empty loses its header).
 */
export const flattenDayGroups = <T extends {id: string | number; date: string; amount: number}>(
  groups: readonly DayGroup<T>[],
  pendingIds: ReadonlySet<string>,
  removedIds: ReadonlySet<string>,
): DayListItem<T>[] => {
  const items: DayListItem<T>[] = [];
  let seenFirstRow = false;
  for (const group of groups) {
    const rows = group.expenses.filter(row => !removedIds.has(String(row.id)));
    if (rows.length === 0) {
      continue;
    }
    // Exact (integer units). Rows may be signed spend rows (domain/periodMath:
    // a refund is negative), so a day's header is its net spending.
    let units = 0;
    for (const row of rows) {
      if (!pendingIds.has(String(row.id))) {
        units += toMoneyUnits(row.amount);
      }
    }
    const total = fromMoneyUnits(units);
    if (!group.headerless) {
      items.push({type: 'header', key: `h:${group.date}`, date: group.date, label: group.label, total});
    }
    for (const row of rows) {
      const id = String(row.id);
      items.push({
        type: 'row',
        key: `r:${id}`,
        row,
        dayLabel: group.dayLabelOf ? group.dayLabelOf(row) : group.dayLabel,
        pending: pendingIds.has(id),
        isFirstRow: !seenFirstRow,
      });
      seenFirstRow = true;
    }
  }
  return items;
};
