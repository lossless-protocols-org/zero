import {AppState} from 'react-native';
import {i18n} from '../../i18n';
import {getAllUsers} from '../../data/services/userService';
import {getBudgetsByMonth} from '../../data/services/budgetService';
import {getCurrencyByUserId} from '../../data/services/currencyService';
import {getExpenseRowsSince} from '../../data/services/expenseService';
import {getMonthAndDaySummary, observeSummaryInputs} from '../../data/services/periodSummaryService';
import {resolveBudget} from '../../domain/budgetMath';
import {formatDate} from '../../domain/dates';
import {formatMonthLabel, getMonthNames} from '../../platform/dateFormat';
import {DEFAULT_MONTH_START_DAY, monthIndexOfKey, periodFor, periodKeyOf, shiftPeriodKey} from '../../domain/period';
import {capsOf} from '../../pro/features';
import {getAppliedPro} from '../../pro/proGate';
import {effectiveMonthStartDay, subscribeMonthStartDay} from '../../pro/monthStart';
import {formatAmountWithSymbol, formatCurrency} from '../../platform/numberFormat';
import {moneyFormatSpec, type MoneyFormatSpec} from '../../platform/moneyFormatSpec';
import {getFormatLocale} from '../../platform/locale';
import {appendErrorLog} from '../../platform/errorLog';
import {widgetAmountsPreference} from '../../platform/widgetPreferences';
import {buildWidgetSnapshot, setupSnapshot, type WidgetSnapshot} from './snapshot';
import {hasWidgetBridge, writeWidgetSnapshot} from './bridge';
import {applyPendingEntries} from './pendingEntries';
import {pickAgain, pickLast} from './again';
import {
  getAllCategoriesByUserId,
  observeCategoryChanges,
  quickWindowStart,
  rankQuickCategories,
} from '../../data/services/categoryService';
import {afterInteractions} from '../../platform/afterInteractions';
import {onTimeToInteractive} from '../../platform/startupMarker';
import {displayCategoryName} from '../../i18n/displayNames';
import {primaryIncomeCategory} from '../../domain/incomeCategories';

/**
 * Keeps the home-screen widget in step with the data (2.8). The only module
 * that talks to the native modules (the layer rules). The widget never reads the
 * database: this writes one JSON snapshot after every change to a table the
 * widget shows, debounced so a burst (a 10k restore, an undo) writes once.
 *
 * Figures are always THIS month and TODAY, whatever month a screen shows,
 * read from the same summary service the app uses (net of refunds, R2).
 */

const DEBOUNCE_MS = 500;

/**
 * The money rules for the iOS side, or null: a platform whose Intl cannot
 * produce them must cost the widget only its offline figure updates, never
 * the snapshot itself.
 */
const moneyRules = (code: string): MoneyFormatSpec | null => {
  try {
    return moneyFormatSpec(code);
  } catch (error) {
    appendErrorLog(error, false);
    return null;
  }
};

const computeSnapshot = async (now: Date): Promise<WidgetSnapshot> => {
  const locale = getFormatLocale();
  const [user] = await getAllUsers();
  if (!user) {
    return setupSnapshot(locale, now.getTime());
  }
  // The month it is now, as the user's month start day cuts it (P11; the 1st without Pro). Worked
  // out from the user row read here, so the widget never depends on a screen having loaded it.
  const monthStartDay = effectiveMonthStartDay(user.monthStartDay, capsOf(getAppliedPro()));
  const monthKey = periodKeyOf(now, monthStartDay);
  const period = periodFor(monthKey, monthStartDay);
  const todayKey = formatDate(now, 'YYYY-MM-DD');
  // "Add again" looks back over this month and the one before; the quick chips over 90 days.
  // One raw read from the earlier of the two covers both (audit 2026-11-08 §8.1: it used to be
  // a 90-day scan plus two month reads that each joined every category).
  const againStart = periodFor(shiftPeriodKey(monthKey, -1), monthStartDay).start;
  const quickStart = quickWindowStart(now);
  const since = againStart < quickStart ? againStart : quickStart;
  const [summary, budgets, currency, expenseCategories, incomeCategories, rows] = await Promise.all([
    getMonthAndDaySummary(user.id, period, todayKey),
    getBudgetsByMonth(user.id, monthKey),
    getCurrencyByUserId(user.id),
    getAllCategoriesByUserId(user.id, 'expense'),
    getAllCategoriesByUserId(user.id, 'income'),
    getExpenseRowsSince(user.id, since),
  ]);
  const {month, day: today} = summary;
  const quick = rankQuickCategories(
    expenseCategories,
    rows.filter(row => row.date >= quickStart).map(row => row.categoryId),
  );
  // This month and the one before, nothing later.
  const recent = rows.filter(row => row.date >= againStart && row.date < period.next);
  const active = new Set(quick.map(category => category.id));
  const overall = resolveBudget(
    budgets.filter(b => b.budgetType === 'monthly'),
    monthKey,
  );
  const money = (amount: number): string =>
    currency?.code
      ? formatAmountWithSymbol(amount, currency.code)
      : `${currency?.symbol ?? ''}${formatCurrency(amount)}`;
  const t = i18n.t.bind(i18n);
  const name = (category: {name: string}): string => displayCategoryName(category.name, t);
  return buildWidgetSnapshot(
    {
      monthKey,
      todayKey,
      monthStartDay,
      // The month's name, or its days when it does not start on the 1st ("7 Nov – 6 Dec").
      monthLabel:
        monthStartDay === DEFAULT_MONTH_START_DAY
          ? (getMonthNames()[monthIndexOfKey(monthKey)] ?? monthKey)
          : formatMonthLabel(period),
      locale,
      spentMonth: month.spent,
      spentToday: today.spent,
      received: month.received,
      budget: overall?.amount ?? null,
      quick: quick.map(category => ({id: category.id, name: name(category)})),
      // The one money lands in (domain/incomeCategories), as the app's own forms choose it.
      incomeCategoryId: primaryIncomeCategory(incomeCategories)?.id ?? null,
      again: pickAgain(recent, active),
      last: pickLast(recent, active),
      money: moneyRules(currency?.code || 'USD'),
      hideAmounts: !widgetAmountsPreference.get(),
      now: now.getTime(),
    },
    {
      money,
      spend: amount => (amount < 0 ? t('refund.back', {amount: money(-amount)}) : money(amount)),
      today: t('widget.today'),
      addExpense: t('widget.addExpense'),
      addIncome: t('widget.addIncome'),
      hidden: t('widget.hidden'),
      left: amount => t('widget.left', {amount}),
      over: amount => t('widget.over', {amount}),
      incomeLine: (received, kept, keptText) =>
        kept >= 0
          ? t('money.receivedLine', {received, kept: keptText})
          : t('money.overReceivedLine', {received, over: keptText}),
      summary: (monthName, spent, todaySpent) => t('widget.summary', {month: monthName, spent, today: todaySpent}),
      templates: {
        left: t('widget.left', {amount: '%@'}),
        over: t('widget.over', {amount: '%@'}),
        back: t('refund.back', {amount: '%@'}),
        received: t('money.receivedLine', {received: '%1$@', kept: '%2$@'}),
        overReceived: t('money.overReceivedLine', {received: '%1$@', over: '%2$@'}),
        summary: t('widget.summary', {month: '%1$@', spent: '%2$@', today: '%3$@'}),
      },
    },
  );
};

/**
 * Computes and writes the snapshot now. Never throws: a widget that could not
 * be refreshed keeps its last figures, and the cause goes to Diagnostics.
 */
export const publishWidgetSnapshot = async (now: Date = new Date()): Promise<void> => {
  if (!hasWidgetBridge()) {
    return; // test runners and platforms without the module
  }
  try {
    writeWidgetSnapshot(JSON.stringify(await computeSnapshot(now)));
  } catch (error) {
    appendErrorLog(error, false);
  }
};

/** Longest wait for first content before the first publish goes anyway (onboarding never shows Home's list). */
const FIRST_PUBLISH_FALLBACK_MS = 3000;

/**
 * Starts keeping the widget current; returns the stop function. Publishes
 * once the app is interactive (the language, currency or day may have changed
 * while it was closed), then on every change to a watched table, on return to
 * the foreground, on a language change, on the amounts setting and when the
 * day months start on changes.
 *
 * The first publish waits for Home's first rows and then for idle: with JSI
 * SQLite every query runs synchronously on the JS thread, and the snapshot's
 * reads used to land half a second after start, exactly when the first fling
 * did (audit 2026-11-08 §8.1). The table watches' initial emission is ignored
 * for the same reason; real changes still schedule a publish.
 */
export const startWidgetPublisher = (): (() => void) => {
  if (!hasWidgetBridge()) {
    return () => undefined;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  // Entries made outside the app (iOS) are saved first; their writes then
  // schedule a publish through the table watch like any other change, and the
  // focused screen reads them like any other write (useFreshWhileFocused).
  const catchUp = (): void => {
    void applyPendingEntries().finally(() => schedule());
  };
  const schedule = (): void => {
    if (!started) {
      return; // the first publish is the start-up one, below
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void publishWidgetSnapshot();
    }, DEBOUNCE_MS);
  };

  // withChangesForTables emits once on subscribe (startWith); only later emissions are changes.
  const afterFirst = (): (() => void) => {
    let primed = false;
    return () => {
      if (primed) {
        schedule();
      }
      primed = true;
    };
  };
  const changes = observeSummaryInputs().subscribe(afterFirst());
  const categories = observeCategoryChanges().subscribe(afterFirst());
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active' && started) {
      catchUp();
    }
  });
  const onLanguage = (): void => schedule();
  i18n.on('languageChanged', onLanguage);
  const unsubscribeAmounts = widgetAmountsPreference.subscribe(schedule);
  // P11: another month start day (or Pro turning on or off) makes "this month" other days.
  const unsubscribeMonthStart = subscribeMonthStartDay(schedule);

  let idle: {cancel: () => void} | null = null;
  let fallback: ReturnType<typeof setTimeout> | null = null;
  let stopWaiting: () => void = () => undefined;
  const begin = (): void => {
    if (idle) {
      return; // already begun (first content and the fallback can both fire)
    }
    if (fallback) {
      clearTimeout(fallback);
    }
    stopWaiting();
    idle = afterInteractions(() => {
      started = true;
      catchUp();
    });
  };
  fallback = setTimeout(begin, FIRST_PUBLISH_FALLBACK_MS);
  // May call begin at once (first content already shown); begin tolerates stopWaiting not yet set.
  stopWaiting = onTimeToInteractive(begin);

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    if (fallback) {
      clearTimeout(fallback);
    }
    stopWaiting();
    idle?.cancel();
    changes.unsubscribe();
    categories.unsubscribe();
    appState.remove();
    i18n.off('languageChanged', onLanguage);
    unsubscribeAmounts();
    unsubscribeMonthStart();
  };
};
