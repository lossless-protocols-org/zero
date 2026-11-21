import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {selectActiveCategories, selectIncomeCategories} from '../../../store/slices/categoryDataSlice';
import {canPayFrom} from '../../../domain/accounts';
import {getAccounts, type AccountSummary} from '../../../data/services/accountService';
import {
  RecurringRuleError,
  createRule,
  deleteRule,
  getRuleById,
  setRulePaused,
  updateRule,
  type RuleData,
  type RuleFields,
} from '../../../data/services/recurringService';
import {createAmountSchema, expenseDescriptionSchema} from '../../../i18n/validationSchema';
import {isCalendarDay, toDayKey, todayIsoDay} from '../../../domain/dates';
import {MAX_INTERVAL, type Cadence, type RuleTarget} from '../../../domain/recurrence';
import {goBack} from '../../../platform/navigationUtils';
import {appendErrorLog} from '../../../platform/errorLog';
import {rerunProducers} from '../../../pro/producers';
import {reminderPermission, requestReminderPermission} from '../../../pro/reminders';
import {remindersAskedPreference} from '../../../platform/proNotices';
import {useDialog} from '../../../ui/context/DialogContext';

/**
 * Add or edit a recurring rule (3.0, plan P9). An edit sends only what
 * changed (L6). After a save the producers run at once, so what is due is
 * made and reminders are set without waiting for the next open. The
 * permission to show reminders is asked for here, the first time a rule with
 * a reminder is saved, and never on launch.
 */
export const useRuleForm = (ruleId?: string) => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const expenseCategories = useAppSelector(selectActiveCategories);
  const incomeCategories = useAppSelector(selectIncomeCategories);
  const [loaded, setLoaded] = useState<RuleData | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [target, setTargetState] = useState<RuleTarget>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [varies, setVaries] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [interval, setIntervalCount] = useState(1);
  const [startPicker, setStartPicker] = useState(`${todayIsoDay()}T09:00:00`);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [remindDaysBefore, setRemindDaysBefore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let live = true;
    Promise.all([getAccounts(userId), ruleId ? getRuleById(ruleId) : Promise.resolve(null)])
      .then(([found, rule]) => {
        if (!live) {
          return;
        }
        setAccounts(found);
        if (rule) {
          setLoaded(rule);
          setTargetState(rule.target);
          setTitle(rule.title);
          setAmount(rule.amount === null ? '' : String(rule.amount));
          setVaries(rule.amount === null);
          setCategoryId(rule.categoryId);
          setAccountId(rule.accountId);
          setToAccountId(rule.toAccountId);
          setCadence(rule.cadence);
          setIntervalCount(rule.interval);
          setStartPicker(`${rule.startDate}T09:00:00`);
          setEndDate(rule.endDate);
          setRemindDaysBefore(rule.remindDaysBefore);
          return;
        }
        // A new rule starts on the default account (and, for a transfer, to the next one).
        const active = found.filter(account => account.active);
        const start = active.find(account => account.isDefault)?.id ?? active[0]?.id ?? '';
        setAccountId(start);
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [userId, ruleId]);

  const categories = useMemo(
    () =>
      target === 'income'
        ? incomeCategories.filter(category => category.categoryStatus)
        : target === 'expense'
          ? expenseCategories
          : [],
    [target, incomeCategories, expenseCategories],
  );
  const active = useMemo(() => accounts.filter(account => account.active), [accounts]);

  const setTarget = useCallback(
    (next: RuleTarget) => {
      setTargetState(next);
      // The category belongs to a kind; a transfer has none and needs a second account.
      setCategoryId('');
      if (next === 'transfer') {
        setToAccountId(active.find(account => account.id !== accountId)?.id ?? null);
      } else {
        setToAccountId(null);
      }
    },
    [active, accountId],
  );

  const pickAccount = useCallback(
    (which: 'from' | 'to') => {
      void SheetManager.show('account-picker-sheet', {
        payload: {
          // A repeating expense is paid from money to spend or a card, as any expense; a transfer may name any.
          accounts: target === 'expense' ? active.filter(account => canPayFrom(account.type)) : active,
          selectedId: which === 'from' ? accountId : (toAccountId ?? undefined),
          onSelect: id => (which === 'from' ? setAccountId(id) : setToAccountId(id)),
        },
      });
    },
    [active, accountId, toAccountId, target],
  );

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const amountValue = Number(amount);
  const amountOk = varies || amountSchema.issues(amountValue).length === 0;
  const startDate = toDayKey(startPicker);
  const titleOk = expenseDescriptionSchema.isValid(title) && (target !== 'expense' || title.trim().length > 0);
  const isValid =
    (!ruleId || loaded !== null) &&
    titleOk &&
    amountOk &&
    (target === 'transfer' ? toAccountId !== null && toAccountId !== accountId : categoryId !== '') &&
    accountId !== '' &&
    isCalendarDay(startDate) &&
    (endDate === null || endDate >= startDate) &&
    interval >= 1 &&
    interval <= MAX_INTERVAL;

  const fields = (): RuleFields => ({
    target,
    title: title.trim(),
    categoryId: target === 'transfer' ? '' : categoryId,
    accountId,
    toAccountId: target === 'transfer' ? toAccountId : null,
    amount: varies ? null : amountValue,
    cadence,
    interval,
    startDate,
    endDate,
    remindDaysBefore,
  });

  /**
   * The first rule saved with a reminder asks, once per install; a refusal is
   * explained then. Later saves do not ask or explain again.
   */
  const askForReminders = async (): Promise<void> => {
    if (remindersAskedPreference.get() || (await reminderPermission()) === 'granted') {
      return;
    }
    remindersAskedPreference.set(true);
    if ((await requestReminderPermission()) !== 'granted') {
      await showAlert({type: 'info', message: t('recurring.permissionOff')});
    }
  };

  const save = async (): Promise<void> => {
    if (!isValid || saving) {
      return;
    }
    setSaving(true);
    try {
      const next = fields();
      if (ruleId && loaded) {
        const patch: Partial<RuleFields> = {};
        for (const key of Object.keys(next) as Array<keyof RuleFields>) {
          if (next[key] !== loaded[key]) {
            // The same key on both sides of a RuleFields: the value has that key's type.
            (patch as Record<string, unknown>)[key] = next[key];
          }
        }
        await updateRule(ruleId, patch, todayIsoDay());
      } else {
        await createRule(userId, next, todayIsoDay());
      }
      await rerunProducers();
      if (next.remindDaysBefore !== null) {
        await askForReminders();
      }
    } catch (error) {
      if (!(error instanceof RecurringRuleError)) {
        appendErrorLog(error, false);
      }
      setSaving(false);
      await showAlert({type: 'error', message: t('recurring.saveFailed')});
      return;
    }
    setSaving(false);
    goBack();
  };

  const togglePaused = async (): Promise<void> => {
    if (!loaded) {
      return;
    }
    try {
      await setRulePaused(loaded.id, loaded.status !== 'paused');
      await rerunProducers();
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('recurring.saveFailed')});
      return;
    }
    goBack();
  };

  const remove = async (): Promise<void> => {
    if (!loaded || !(await showDialog({type: 'warning', message: t('recurring.deleteConfirm')}))) {
      return;
    }
    try {
      await deleteRule(loaded.id);
      await rerunProducers();
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('recurring.saveFailed')});
      return;
    }
    goBack();
  };

  return {
    isEditing: Boolean(ruleId),
    loaded,
    target,
    setTarget,
    title,
    setTitle,
    amount,
    setAmount,
    varies,
    setVaries,
    categories,
    categoryId,
    setCategoryId,
    from: accounts.find(account => account.id === accountId),
    to: accounts.find(account => account.id === toAccountId),
    pickAccount,
    cadence,
    setCadence,
    interval,
    setIntervalCount,
    startPicker,
    setStartPicker,
    endDate,
    setEndDate,
    remindDaysBefore,
    setRemindDaysBefore,
    isValid,
    saving,
    save,
    togglePaused,
    remove,
  };
};
