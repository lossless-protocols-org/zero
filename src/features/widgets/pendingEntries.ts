import {createExpense} from '../../data/services/expenseService';
import {getAllUsers} from '../../data/services/userService';
import {getCurrencyByUserId} from '../../data/services/currencyService';
import {getAllCategoriesByUserId} from '../../data/services/categoryService';
import {createIncome} from '../../data/services/incomeService';
import {ensureYearInCache} from '../../data/services/availableYearsCache';
import {createAmountSchema} from '../../i18n/validationSchema';
import {displayCategoryName} from '../../i18n/displayNames';
import {i18n} from '../../i18n';
import {isIsoDay, toDayKey} from '../../domain/dates';
import {appendErrorLog} from '../../platform/errorLog';
import {readPendingEntries, removePendingEntries} from './bridge';

/**
 * Entries made outside the app (2.8, iOS: Siri, Shortcuts, the Action Button,
 * a Control Center control). Those run where zero's JavaScript cannot, so
 * they only queue the entry in the App Group (and redraw the widget with it);
 * the app saves each one here, through the same services as every other
 * entry, the next time it runs. Each keeps the id it was queued under, so a
 * replay after a crash saves it once (createExpense/createIncome `id`).
 */
interface PendingEntry {
  id: string;
  kind: 'expense' | 'income';
  amount: number;
  categoryId: string;
  /** The expense's title or the money in's note; may be empty. */
  title: string;
  /** Local date-time 'YYYY-MM-DDTHH:mm:ss' when it was made. */
  date: string;
}

/** An expense title is 1–25 characters; a blank one takes the category's name (as the quick-add sheet). */
const TITLE_MAX = 25;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** Reads the queue; anything that is not a well-formed entry is left out (and logged). @internal test */
export const parsePendingEntries = (json: string): PendingEntry[] => {
  let list: unknown;
  try {
    list = JSON.parse(json);
  } catch (error) {
    appendErrorLog(error, false);
    return [];
  }
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((item): item is PendingEntry => {
    const e = item as Partial<Record<keyof PendingEntry, unknown>> | null; // narrowed field by field below
    const ok =
      !!e &&
      typeof e.id === 'string' &&
      e.id.length > 0 &&
      (e.kind === 'expense' || e.kind === 'income') &&
      typeof e.amount === 'number' &&
      Number.isFinite(e.amount) &&
      e.amount > 0 &&
      typeof e.categoryId === 'string' &&
      typeof e.title === 'string' &&
      typeof e.date === 'string' &&
      LOCAL_DATE_TIME.test(e.date);
    if (!ok) {
      appendErrorLog(new Error('pending entry dropped: malformed'), false);
    }
    return ok;
  });
};

let running: Promise<string[]> | null = null;

/**
 * Saves every queued entry and removes the saved ones from the queue. Never
 * throws; one at a time (a second call joins the first). An entry whose
 * amount the currency cannot hold is dropped (logged); one whose save fails
 * stays queued for the next run.
 *
 * Resolves with the 'YYYY-MM' months it wrote to. Refreshing what screens
 * hold is the caller's (the app shell's): this module writes through the
 * services and never reaches into the store (audit 2026-11-08 §4.6).
 */
export const applyPendingEntries = (): Promise<string[]> => {
  running ??= drain().finally(() => {
    running = null;
  });
  return running;
};

const drain = async (): Promise<string[]> => {
  try {
    const entries = parsePendingEntries(await readPendingEntries());
    if (entries.length === 0) {
      return [];
    }
    const [user] = await getAllUsers();
    if (!user) {
      return []; // before onboarding: keep them until there is someone to save them for
    }
    const currency = await getCurrencyByUserId(user.id);
    const amountSchema = createAmountSchema(currency?.code ?? '');
    const expenseCategories = (await getAllCategoriesByUserId(user.id, 'expense')).filter(
      c => c.categoryStatus !== false,
    );
    // Every user has an active income category (createUser, the v5 upgrade, a restore; the
    // session bootstrap repairs it if a path ever broke that), so this only reads it.
    const incomeCategories = entries.some(e => e.kind === 'income')
      ? (await getAllCategoriesByUserId(user.id, 'income')).filter(c => c.categoryStatus !== false)
      : [];

    // Each entry leaves the queue the moment it is settled: saved, or dropped because it can
    // never be. The native side adds every QUEUED entry to the widget's figures, so an entry
    // left behind was counted again on every publish, forever (audit 2026-11-08 §3.4), and a
    // saved one still queued was briefly counted twice.
    const settle = (id: string): void => removePendingEntries([id]);
    const drop = (id: string, why: string): void => {
      appendErrorLog(new Error(`pending entry dropped: ${why}`), false);
      settle(id);
    };
    const months = new Set<string>();
    for (const entry of entries) {
      if (!amountSchema.isValid(entry.amount)) {
        drop(entry.id, 'amount out of range');
        continue;
      }
      try {
        if (entry.kind === 'income') {
          // A category deleted since the entry was made: the first one still there.
          const category = incomeCategories.find(c => c.id === entry.categoryId) ?? incomeCategories[0];
          const day = toDayKey(entry.date);
          if (!isIsoDay(day)) {
            drop(entry.id, 'not a day');
            continue;
          }
          if (!category) {
            // Repairable (bootstrapSession restores the income category), so kept for the next
            // run rather than dropped: dropping would lose money the user said came in.
            appendErrorLog(new Error('pending entry kept: no active income category yet'), false);
            continue;
          }
          await createIncome(
            user.id,
            {categoryId: category.id, amount: entry.amount, date: day, note: entry.title.trim()},
            {id: entry.id},
          );
        } else {
          const category = expenseCategories.find(c => c.id === entry.categoryId) ?? expenseCategories[0];
          if (!category) {
            drop(entry.id, 'no active expense category');
            continue;
          }
          const title = (entry.title.trim() || displayCategoryName(category.name, i18n.t.bind(i18n))).slice(
            0,
            TITLE_MAX,
          );
          await createExpense(user.id, title, entry.amount, '', category.id, entry.date, {id: entry.id});
          ensureYearInCache(user.id, Number.parseInt(entry.date.slice(0, 4), 10));
        }
        settle(entry.id);
        months.add(entry.date.slice(0, 7));
      } catch (error) {
        appendErrorLog(error, false); // a save that failed (disk, lock): stays queued, tried again next time
      }
    }
    return [...months];
  } catch (error) {
    appendErrorLog(error, false);
    return [];
  }
};
