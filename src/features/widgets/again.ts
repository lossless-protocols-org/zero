import {titleKey} from '../../domain/titleKey';

/**
 * "Add again" (2.8): the expenses someone keeps typing (the daily chai, the
 * bus fare), offered on the iOS widget and to Siri as one tap or one phrase
 * that adds the same thing once more, without opening zero. Pure.
 *
 * An entry counts as "the same" when its title, category and amount match.
 * Only what was entered at least twice in the window is offered, so a one-off
 * purchase never becomes a button; the most recently used come first.
 */

/** An expense as the picker needs it. `date` is ISO ('YYYY-MM-DD…'), so it sorts as text. */
export interface AgainSource {
  title: string;
  amount: number;
  categoryId: string;
  date: string;
}

export interface AgainEntry {
  title: string;
  amount: number;
  categoryId: string;
}

/** At most this many "Add again" entries are offered. */
const AGAIN_MAX = 3;
/** Entered at least this often in the window to be offered. */
const AGAIN_MIN_USES = 2;

/** Titles compare as categorise-from-history compares them (domain/titleKey). */
const keyOf = (e: AgainEntry): string => `${titleKey(e.title)}\u0000${e.categoryId}\u0000${e.amount}`;

/**
 * The entries to offer, most recently used first. `activeCategoryIds`: an
 * entry in an archived or deleted category is never offered.
 */
export const pickAgain = (
  expenses: ReadonlyArray<AgainSource>,
  activeCategoryIds: ReadonlySet<string>,
): AgainEntry[] => {
  const groups = new Map<string, {entry: AgainEntry; uses: number; last: string}>();
  for (const e of expenses) {
    if (!activeCategoryIds.has(e.categoryId) || !(e.amount > 0)) {
      continue;
    }
    const entry = {title: e.title.trim(), amount: e.amount, categoryId: e.categoryId};
    const key = keyOf(entry);
    const group = groups.get(key);
    if (group) {
      group.uses += 1;
      if (e.date > group.last) {
        group.last = e.date;
      }
    } else {
      groups.set(key, {entry, uses: 1, last: e.date});
    }
  }
  return [...groups.values()]
    .filter(g => g.uses >= AGAIN_MIN_USES)
    .sort((a, b) => (a.last === b.last ? b.uses - a.uses : a.last < b.last ? 1 : -1))
    .slice(0, AGAIN_MAX)
    .map(g => g.entry);
};

/** The latest expense in an active category, for "repeat my last expense"; null if none. */
export const pickLast = (
  expenses: ReadonlyArray<AgainSource>,
  activeCategoryIds: ReadonlySet<string>,
): AgainEntry | null => {
  let best: AgainSource | null = null;
  for (const e of expenses) {
    if (activeCategoryIds.has(e.categoryId) && e.amount > 0 && (!best || e.date > best.date)) {
      best = e;
    }
  }
  return best ? {title: best.title.trim(), amount: best.amount, categoryId: best.categoryId} : null;
};
