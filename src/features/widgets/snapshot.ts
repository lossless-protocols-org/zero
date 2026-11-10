import {keptOf} from '../../domain/periodMath';
import type {MoneyFormatSpec} from '../../platform/moneyFormatSpec';
import type {AgainEntry} from './again';
import widgetAssets from '../../../contracts/widget-assets.json';

/**
 * What the home-screen widget shows, as ready-made text (2.8). Pure: the
 * caller supplies the figures, a money formatter and the translated labels,
 * so the widget needs no number formatting of its own and the in-app
 * language override applies to it. Versioned: the native reader refuses an
 * unknown `v` and shows its "open zero" state instead of guessing.
 *
 * Privacy: with amounts hidden, every figure is replaced by "••••" HERE, so
 * no amount is ever written to the widget's storage, and the budget bar is
 * left out (its length would give the figure away).
 */
/** @internal test */
export const WIDGET_SNAPSHOT_VERSION = 1;

export interface WidgetSnapshot {
  v: typeof WIDGET_SNAPSHOT_VERSION;
  state: 'ready' | 'setup';
  /** BCP 47 tag; the widget formats a new month's name with it after a rollover. */
  locale: string;
  /** 'YYYY-MM' and 'YYYY-MM-DD' the figures belong to; older ones read as 0 on the widget. */
  monthKey: string;
  todayKey: string;
  monthLabel: string;
  spentMonth: string;
  spentToday: string;
  /** "₹0": shown for today (and the month) once the date has moved past the snapshot. */
  zero: string;
  /** Budget bar and line; null without a budget, or with amounts hidden. */
  budget: {progress: number; over: boolean; text: string} | null;
  /** "Received ₹50,000 · Kept ₹4,971" once the month has money in. */
  incomeLine: string | null;
  labels: {today: string; addExpense: string; addIncome: string; summary: string};
  /**
   * Category chips for a one-tap quick add, most used first (at most
   * QUICK_CHIPS). Names only, never amounts, so they show with amounts hidden.
   */
  quick: Array<{id: string; name: string}>;
  /** Every active expense category, quick order first: what Siri and Shortcuts offer (iOS). */
  categories: Array<{id: string; name: string}>;
  /** Where money in goes when it is added from outside the app; null before there is one. */
  incomeCategoryId: string | null;
  /** How money is written (MoneyFormatSpec): formatting rules, never an amount. Null before onboarding. */
  money: MoneyFormatSpec | null;
  /**
   * What the iOS side needs to redo the figures itself after an entry made
   * from Siri, Shortcuts or a control, before zero has run: the raw amounts
   * and the translated templates (%@ / %1$@ placeholders). Null with amounts
   * hidden, so no amount is stored at all (privacy rule).
   */
  live: WidgetLive | null;
  /**
   * "Add again" (iOS): expenses entered often, one tap or phrase adds the same
   * once more. Empty with amounts hidden (each carries its amount).
   */
  again: WidgetAgain[];
  /** The latest expense, for "repeat my last expense"; null with amounts hidden. */
  last: WidgetAgain | null;
  /**
   * Placeholder figures for the widget picker's generated preview (Android
   * 15+): in the user's currency and language, never the user's own numbers.
   */
  preview: {spentMonth: string; spentToday: string; budgetText: string};
  computedAt: number;
}

interface WidgetLive {
  spentMonth: number;
  spentToday: number;
  received: number;
  budget: number | null;
  templates: {
    left: string;
    over: string;
    back: string;
    received: string;
    overReceived: string;
    summary: string;
  };
}

interface WidgetAgain {
  /** What it was for; the category's name when it had no title of its own. */
  title: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  /** The amount as the app writes it ("₹20"). */
  amountText: string;
}

/** How many category chips the widget can show at most. */
const QUICK_CHIPS = 4;

/**
 * The made-up month the picker preview shows: the same figures the native
 * fallbacks use (contracts/widget-assets.json, one source for all three).
 */
const PREVIEW = widgetAssets.preview;

interface WidgetFigures {
  monthKey: string;
  todayKey: string;
  monthLabel: string;
  locale: string;
  /** Net of refunds (R2). */
  spentMonth: number;
  spentToday: number;
  received: number;
  /** The month's overall budget in force, or null. */
  budget: number | null;
  /** Expense categories in quick-add order, names already translated. */
  quick: ReadonlyArray<{id: string; name: string}>;
  incomeCategoryId: string | null;
  /** Entries to offer again, and the latest one (pickAgain / pickLast). */
  again: ReadonlyArray<AgainEntry>;
  last: AgainEntry | null;
  /** The money rules for these figures (MoneyFormatSpec); null if they could not be read. */
  money: MoneyFormatSpec | null;
  hideAmounts: boolean;
  now: number;
}

interface WidgetText {
  /** Money as the app shows it (symbol, grouping, decimals). */
  money: (amount: number) => string;
  /** Net spend: a negative day reads as money back ("₹62 back"). */
  spend: (amount: number) => string;
  today: string;
  addExpense: string;
  addIncome: string;
  hidden: string;
  left: (amount: string) => string;
  over: (amount: string) => string;
  incomeLine: (received: string, kept: number, keptText: string) => string;
  summary: (month: string, spent: string, today: string) => string;
  /** The same sentences with %@ / %1$@ in place of every figure, for the iOS side. */
  templates: WidgetLive['templates'];
}

/** The snapshot for a device with no user yet: the widget shows "Open zero to start". */
export const setupSnapshot = (locale: string, now: number): WidgetSnapshot => ({
  v: WIDGET_SNAPSHOT_VERSION,
  state: 'setup',
  locale,
  monthKey: '',
  todayKey: '',
  monthLabel: '',
  spentMonth: '',
  spentToday: '',
  zero: '',
  budget: null,
  incomeLine: null,
  labels: {today: '', addExpense: '', addIncome: '', summary: ''},
  quick: [],
  categories: [],
  incomeCategoryId: null,
  money: null,
  live: null,
  again: [],
  last: null,
  preview: {spentMonth: '', spentToday: '', budgetText: ''},
  computedAt: now,
});

export const buildWidgetSnapshot = (f: WidgetFigures, text: WidgetText): WidgetSnapshot => {
  const show = (value: string): string => (f.hideAmounts ? text.hidden : value);
  const spentMonth = show(text.spend(f.spentMonth));
  const spentToday = show(text.spend(f.spentToday));

  let budget: WidgetSnapshot['budget'] = null;
  if (f.budget !== null && f.budget > 0 && !f.hideAmounts) {
    const left = keptOf(f.budget, f.spentMonth);
    budget = {
      progress: Math.max(0, Math.min(1, f.spentMonth / f.budget)),
      over: left < 0,
      text: left < 0 ? text.over(text.money(-left)) : text.left(text.money(left)),
    };
  }

  const names = new Map(f.quick.map(c => [c.id, c.name]));
  const offer = (entry: AgainEntry): WidgetAgain | null => {
    const categoryName = names.get(entry.categoryId);
    if (categoryName === undefined) {
      return null; // not an active expense category any more
    }
    return {
      title: entry.title || categoryName,
      categoryId: entry.categoryId,
      categoryName,
      amount: entry.amount,
      amountText: text.money(entry.amount),
    };
  };
  const again = f.hideAmounts ? [] : f.again.flatMap(entry => offer(entry) ?? []);
  const last = f.hideAmounts || !f.last ? null : offer(f.last);

  const kept = keptOf(f.received, f.spentMonth);
  const incomeLine =
    f.received > 0 ? text.incomeLine(show(text.money(f.received)), kept, show(text.money(Math.abs(kept)))) : null;

  return {
    v: WIDGET_SNAPSHOT_VERSION,
    state: 'ready',
    locale: f.locale,
    monthKey: f.monthKey,
    todayKey: f.todayKey,
    monthLabel: f.monthLabel,
    spentMonth,
    spentToday,
    zero: show(text.money(0)),
    budget,
    incomeLine,
    labels: {
      today: text.today,
      addExpense: text.addExpense,
      addIncome: text.addIncome,
      summary: text.summary(f.monthLabel, spentMonth, spentToday),
    },
    quick: f.quick.slice(0, QUICK_CHIPS).map(({id, name}) => ({id, name})),
    categories: f.quick.map(({id, name}) => ({id, name})),
    incomeCategoryId: f.incomeCategoryId,
    money: f.money,
    live: f.hideAmounts
      ? null
      : {
          spentMonth: f.spentMonth,
          spentToday: f.spentToday,
          received: f.received,
          budget: f.budget !== null && f.budget > 0 ? f.budget : null,
          templates: text.templates,
        },
    again,
    last,
    preview: {
      spentMonth: text.money(PREVIEW.spentMonth),
      spentToday: text.money(PREVIEW.spentToday),
      budgetText: text.left(text.money(PREVIEW.budgetLeft)),
    },
    computedAt: f.now,
  };
};
