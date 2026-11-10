import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {selectActiveCategories} from '../../../store/slices/categoryDataSlice';
import {createExpense, updateExpenseById} from '../../../data/services/expenseService';
import type {CategoryData, ExpenseWithCategory} from '../../../domain/types';
import {ensureYearInCache} from '../../../data/services/availableYearsCache';
import {findCategoryIdForTitle} from '../../../data/services/expenseService';
import {appendErrorLog} from '../../../platform/errorLog';
import {createAmountSchema, expenseDescriptionSchema, expenseSchema} from '../../../i18n/validationSchema';
import {formatDate, getISODateTime} from '../../../domain/dates';
import {goBack, navigate} from '../../../platform/navigationUtils';
import {useReportSaveFailure} from '../../../ui/hooks/useReportFailure';
import {RefundRuleError, getRefundsByExpense} from '../../../data/services/refundService';
import {netSpent} from '../../../domain/periodMath';
import {useDialog} from '../../../ui/context/DialogContext';
import {useTranslation} from 'react-i18next';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import type {QuickAddDraft} from '../../../ui/quickAddDraft';

/** How long typing must pause before the title is looked up in the history (2.8). */
const HISTORY_PAUSE_MS = 400;

/** The transaction being edited, as read from the database (M19). */
export type EditedExpense = ExpenseWithCategory;

/**
 * Re-selects the expense's category by id. Never by name: a soft-deleted
 * category is not in the active list, and matching a same-named active one
 * would move the expense on save without the user choosing it.
 */
const matchCategory = (categories: CategoryData[], target: {id: string} | undefined): CategoryData[] => {
  const match = target ? categories.find(category => category.id === target.id) : undefined;
  return match ? [match] : [];
};

/**
 * State and save for the add/edit transaction form; `editing` absent = add.
 * `draft` pre-fills an add from the quick-add sheet's "More details".
 */
export const useExpenseForm = (editing?: EditedExpense, draft?: QuickAddDraft) => {
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const categories = useAppSelector(selectActiveCategories);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<CategoryData[]>(
    editing ? matchCategory(categories, editing.category) : [],
  );
  const [createdAt, setCreatedAt] = useState(editing?.date ?? getISODateTime());
  const [expenseTitle, setExpenseTitle] = useState(editing?.title ?? draft?.title ?? '');
  const [expenseDescription, setExpenseDescription] = useState(editing?.description ?? '');
  const [expenseAmount, setExpenseAmount] = useState(editing ? String(editing.amount) : (draft?.amount ?? ''));

  // Limits follow the currency: a yen has no decimals, COP amounts run into
  // the millions. A flat 1,000,000 cap blocked ordinary expenses (B6).
  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const expenseAmountError = hasInteracted ? amountSchema.issues(Number(expenseAmount)) : [];
  const isValid =
    expenseSchema.isValid(expenseTitle) &&
    expenseDescriptionSchema.isValid(expenseDescription) &&
    amountSchema.isValid(Number(expenseAmount));

  // In edit mode (or from a quick-add draft) the initial state above runs
  // before the category slice is populated, which would leave the expense
  // looking uncategorised (and the button disabled). Re-sync once the
  // categories actually arrive.
  const targetCategoryId = editing?.category?.id ?? draft?.categoryId;
  useEffect(() => {
    if (!targetCategoryId) {
      return;
    }
    setSelectedCategories(current => {
      if (current.length > 0) {
        return current;
      }
      const match = matchCategory(categories, {id: targetCategoryId});
      return match.length ? match : current;
    });
  }, [targetCategoryId, categories]);

  // Categorise from history (2.8): adding, with no category chosen by hand,
  // a pause in typing the title preselects the category of the newest
  // expense with the same title. Any tap on a chip takes over for good; a
  // title with no history takes back only a preselection it made itself.
  const [categoryChosen, setCategoryChosen] = useState(Boolean(editing || draft?.categoryId));
  const [fromHistory, setFromHistory] = useState(false);
  const lookup = useRef(0);
  /** The current selection is the history's, not the user's. */
  const suggested = useRef(false);
  useEffect(() => {
    if (categoryChosen || !userId) {
      return;
    }
    const ticket = ++lookup.current;
    const timer = setTimeout(() => {
      findCategoryIdForTitle(userId, expenseTitle)
        .then(id => {
          if (ticket !== lookup.current) {
            return; // the title changed again since
          }
          const match = id ? categories.find(category => category.id === id) : undefined;
          if (match) {
            setSelectedCategories([match]);
          } else if (suggested.current) {
            setSelectedCategories([]);
          }
          suggested.current = Boolean(match);
          setFromHistory(Boolean(match));
        })
        .catch((error: unknown) => appendErrorLog(error, false));
    }, HISTORY_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [expenseTitle, categoryChosen, userId, categories]);

  // Gates validation errors: don't flag an amount until the user has left the
  // field, so "0." mid-typing doesn't render as an error.
  const handleAmountBlur = useCallback(() => {
    setHasInteracted(true);
  }, []);

  // A failed save used to be visible only in a __DEV__ console — in production
  // the tap did nothing and the user had no idea whether anything was stored (B5).
  const reportSaveFailure = useReportSaveFailure('transaction.saveFailed');
  const {showAlert} = useDialog();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();

  /** An edit the refunds forbid (lower than what came back, or after a refund's day): say which. */
  const explainRefundRule = useCallback(
    async (error: RefundRuleError, expenseId: string) => {
      if (error.rule === 'expenseBelowRefunds') {
        const refunded = netSpent(await getRefundsByExpense(expenseId), []);
        await showAlert({type: 'error', message: t('refund.expenseBelowRefunds', {amount: formatAmount(refunded)})});
        return;
      }
      await showAlert({type: 'error', message: t('refund.expenseAfterRefund')});
    },
    [showAlert, t, formatAmount],
  );

  const save = useCallback(async () => {
    const category = selectedCategories[0];
    if (!isValid || !category) {
      return;
    }
    try {
      if (editing) {
        await updateExpenseById(
          editing.id,
          category.id,
          expenseTitle,
          Number(expenseAmount),
          expenseDescription,
          createdAt,
        );
      } else {
        await createExpense(userId, expenseTitle, Number(expenseAmount), expenseDescription, category.id, createdAt);
      }
    } catch (error) {
      if (editing && error instanceof RefundRuleError) {
        await explainRefundRule(error, editing.id);
        return;
      }
      await reportSaveFailure(error);
      return;
    }
    ensureYearInCache(userId, Number.parseInt(formatDate(createdAt, 'YYYY'), 10));
    goBack(); // the list underneath reads what it shows again on focus (useFreshWhileFocused)
  }, [
    isValid,
    selectedCategories,
    editing,
    userId,
    expenseTitle,
    expenseAmount,
    expenseDescription,
    createdAt,
    reportSaveFailure,
    explainRefundRule,
  ]);

  /**
   * "Add Category" from this form: the category made there comes back
   * chosen. The form notes the categories it has, then picks the one that
   * appears; the store learns of it through the session follower
   * (store/followSession). Nothing appearing (the user went back) leaves the
   * choice as it was. It used to come back unselected (found on the Moto,
   * 2026-11-09; the manual test expected it chosen).
   */
  const knownBeforeAdd = useRef<ReadonlySet<string> | null>(null);
  const addCategory = useCallback(() => {
    knownBeforeAdd.current = new Set(categories.map(category => category.id));
    navigate('AddCategoryScreen');
  }, [categories]);
  useEffect(() => {
    const known = knownBeforeAdd.current;
    const created = known ? categories.find(category => !known.has(category.id)) : undefined;
    if (!created) {
      return;
    }
    knownBeforeAdd.current = null;
    setCategoryChosen(true);
    lookup.current++;
    suggested.current = false;
    setFromHistory(false);
    setSelectedCategories([created]);
  }, [categories]);

  const toggleCategorySelection = useCallback((category: CategoryData) => {
    setCategoryChosen(true);
    // Void a lookup already in flight: its answer would otherwise land after this tap and
    // replace the user's choice with the history's (audit 2026-11-08 §3.3).
    lookup.current++;
    suggested.current = false;
    setFromHistory(false);
    // Compare by id, not object identity: fetchCategories() replaces the array
    // with fresh objects, and reference equality would then fail to deselect.
    setSelectedCategories(current => (current.some(selected => selected.id === category.id) ? [] : [category]));
  }, []);

  return {
    categories,
    selectedCategories,
    toggleCategorySelection,
    addCategory,
    /** The chosen category came from an earlier expense with this title (shown as a hint). */
    fromHistory,
    createdAt,
    setCreatedAt,
    expenseTitle,
    setExpenseTitle,
    expenseDescription,
    setExpenseDescription,
    expenseAmount,
    setExpenseAmount,
    expenseAmountError,
    handleAmountBlur,
    isValid,
    save,
  };
};
