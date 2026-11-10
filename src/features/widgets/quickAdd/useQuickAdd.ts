import {useCallback, useEffect, useMemo, useState} from 'react';
import {AccessibilityInfo, Alert, Platform, ToastAndroid} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {fetchExpensesByMonth} from '../../../store/slices/expenseDataSlice';
import {fetchIncomesByMonth} from '../../../store/slices/incomeDataSlice';
import {fetchCategories} from '../../../store/slices/categoryDataSlice';
import {createExpense} from '../../../data/services/expenseService';
import type {CategoryData} from '../../../domain/types';
import {getAllCategoriesByUserId, getQuickCategories} from '../../../data/services/categoryService';
import {createIncome} from '../../../data/services/incomeService';
import {ensureYearInCache} from '../../../data/services/availableYearsCache';
import {createAmountSchema, expenseDescriptionSchema} from '../../../i18n/validationSchema';
import {displayCategoryName} from '../../../i18n/displayNames';
import {formatDate, getISODateTime, isIsoDay, toDayKey} from '../../../domain/dates';
import {appendErrorLog} from '../../../platform/errorLog';
import {setQuickAddDraft} from '../../../ui/quickAddDraft';
import {publishWidgetSnapshot} from '../publish';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';

export type QuickAddKind = 'expense' | 'income';

/**
 * Says how the save went. Android: a toast, since the sheet closes onto the
 * home screen. iOS (the sheet sits over the app): the new row on Home is the
 * confirmation, so success is only announced to VoiceOver; a failure is an
 * alert, never silent.
 */
const tell = (message: string, failed: boolean): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, failed ? ToastAndroid.LONG : ToastAndroid.SHORT);
  } else if (failed) {
    Alert.alert(message);
  } else {
    AccessibilityInfo.announceForAccessibility(message);
  }
};

/** An expense title is 1–25 characters (expenseSchema); a blank one takes the category's name. */
const TITLE_MAX = 25;

/**
 * State and save for the quick-add sheet (2.8): the amount, one category and
 * an optional title or note; the date is now. Saves through the same services
 * as the full forms, refreshes the app's store (the app may be open
 * underneath), redraws the widget, confirms with a toast and closes.
 * Money in stays a separate entry point (R11): the kind comes from where the
 * sheet was opened and is never switched inside it.
 */
/** What an "add again" entry fills in: the amount as typed ("20") and its title. */
export interface QuickAddPrefill {
  amount: string;
  text: string;
}

export const useQuickAdd = (
  kind: QuickAddKind,
  initialCategoryId: string,
  /** Leaves the sheet (animated), then runs the given step; by default closes it. */
  leave: (then?: () => void) => void,
  /** Hands over to the full form (QuickAddHost.openFull). */
  openFull: (kind: QuickAddKind) => void,
  /** "Add again" (Android widget): the sheet opens filled in, one tap from Save. */
  prefill?: QuickAddPrefill,
) => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [categories, setCategories] = useState<CategoryData[] | null>(null);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [amount, setAmount] = useState(prefill?.amount ?? '');
  const [text, setText] = useState(prefill?.text ?? '');
  const [saving, setSaving] = useState(false);

  // The user and currency come from the session the sheet's root starts (bootstrapSession).

  useEffect(() => {
    if (!userId) {
      return;
    }
    // Every user has an active income category from the start (createUser, upgrade, restore).
    const load = kind === 'income' ? getAllCategoriesByUserId(userId, 'income') : getQuickCategories(userId);
    load
      .then(list => {
        const active = list.filter(c => c.categoryStatus !== false);
        setCategories(active);
        // A chip that no longer exists (deleted since the widget drew it) falls back to the first.
        setCategoryId(current => (active.some(c => c.id === current) ? current : (active[0]?.id ?? '')));
      })
      .catch((error: unknown) => {
        appendErrorLog(error, false);
        setCategories([]);
      });
  }, [kind, userId]);

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const category = categories?.find(c => c.id === categoryId);
  const isValid =
    amountSchema.isValid(Number(amount)) &&
    !!category &&
    expenseDescriptionSchema.isValid(text) &&
    (kind === 'income' || text.trim().length <= TITLE_MAX);

  const name = useCallback((c: CategoryData) => displayCategoryName(c.name, t), [t]);

  const save = useCallback(async () => {
    if (!isValid || saving || !category || !userId) {
      return;
    }
    setSaving(true);
    const value = Number(amount);
    const now = getISODateTime();
    try {
      if (kind === 'income') {
        const day = toDayKey(now);
        if (!isIsoDay(day)) {
          throw new Error(`quick add: not a day: ${day}`);
        }
        await createIncome(userId, {categoryId: category.id, amount: value, date: day, note: text.trim()});
        await dispatch(fetchIncomesByMonth(formatDate(now, 'YYYY-MM')));
      } else {
        const title = (text.trim() || name(category)).slice(0, TITLE_MAX);
        await createExpense(userId, title, value, '', category.id, now);
        ensureYearInCache(userId, Number.parseInt(formatDate(now, 'YYYY'), 10));
        await dispatch(fetchExpensesByMonth(formatDate(now, 'YYYY-MM')));
      }
    } catch (error) {
      appendErrorLog(error, false);
      setSaving(false);
      tell(t('quickAdd.saveFailed'), true);
      return;
    }
    // The app's own publisher may not be running (the sheet opened on its own): redraw now.
    await publishWidgetSnapshot();
    const shown = formatAmount(value);
    tell(
      kind === 'income'
        ? t('quickAdd.addedIncome', {amount: shown})
        : t('quickAdd.added', {amount: shown, category: name(category)}),
      false,
    );
    leave();
  }, [isValid, saving, category, userId, amount, kind, text, dispatch, name, t, formatAmount, leave]);

  /** The full form, carrying what was typed (expense) or opened fresh (money in). */
  const moreDetails = useCallback(() => {
    if (kind === 'income') {
      leave(() => openFull('income'));
      return;
    }
    setQuickAddDraft({title: text.trim().slice(0, TITLE_MAX), amount, categoryId});
    void dispatch(fetchCategories());
    leave(() => openFull('expense'));
  }, [kind, text, amount, categoryId, dispatch, leave, openFull]);

  return {
    userId,
    categories,
    categoryId,
    setCategoryId,
    amount,
    setAmount,
    text,
    setText,
    saving,
    isValid,
    save,
    moreDetails,
    name,
  };
};
