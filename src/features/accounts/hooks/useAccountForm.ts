import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {
  AccountRuleError,
  createAccount,
  getAccountById,
  getAccounts,
  updateAccount,
  type AccountFields,
  type AccountRecord,
} from '../../../data/services/accountService';
import {createRule} from '../../../data/services/recurringService';
import {
  ACCOUNT_NAME_MAX,
  accountKindKey,
  classOf,
  cleanAccountKind,
  isValidAccountKind,
  isValidAccountName,
  sideOf,
  storedTypeFor,
  type AccountClass,
} from '../../../domain/accounts';
import {shiftIsoDay, todayIsoDay} from '../../../domain/dates';
import {normalizeAmountInput, normalizeSignedAmountInput} from '../../../domain/amountInput';
import {goBack} from '../../../platform/navigationUtils';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';
import {useProFeature} from '../../../ui/hooks/useProFeature';
import {kindLabelOf} from '../../../ui/accountWords';
import {ACCOUNT_TYPE_ICON, parseSignedAmount} from '../accountCopy';

/** How often a loan is repaid (world review W3): a weekly wage repays weekly, a monthly salary monthly. */
export const REPAY_CADENCES = ['weekly', 'twoWeeks', 'monthly'] as const;
export type RepayCadence = (typeof REPAY_CADENCES)[number];

/** A repayment's schedule as the repeat engine stores it, and the days from today to its first one by default. */
const REPAY_RULE: Record<RepayCadence, {cadence: 'weekly' | 'monthly'; interval: number; firstInDays: number}> = {
  weekly: {cadence: 'weekly', interval: 1, firstInDays: 7},
  twoWeeks: {cadence: 'weekly', interval: 2, firstInDays: 14},
  monthly: {cadence: 'monthly', interval: 1, firstInDays: 30},
};

/**
 * Add or edit an account (approved A2/A3; round two item 8). What it is was
 * chosen at the plus (Spend or Save on Money; Card or Loan on Debts), so a
 * new account's class is given, not picked here. The user gives its name,
 * what it holds or what is owed today, and may put it in a group, their own
 * word (stored as the kind; the stored type follows from class and group,
 * domain/accounts.storedTypeFor). An edit sends only what changed (law L6),
 * so a rename does not rewrite the opening balance, and an account restored
 * with an unknown type keeps it until the user changes its class or group.
 * An edit may move an account between the two classes of its own side only.
 * A new loan may carry its repayment: saving it then also sets the repeating
 * transfer that pays it, every week, every two weeks or every month (W3).
 */
export const useAccountForm = (accountId?: string, startClass: AccountClass = 'spend') => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const userId = useAppSelector(selectUserId);
  const recurringOn = useProFeature('recurring');
  const [loaded, setLoaded] = useState<AccountRecord | null>(null);
  const [name, setName] = useState('');
  const [accountClass, setAccountClass] = useState<AccountClass>(startClass);
  const [kind, setKind] = useState('');
  // The kind as the form first showed it: the user's own, or the word its stored type stands for.
  const [shownKind, setShownKind] = useState('');
  const [opening, setOpeningText] = useState('');
  // null: from the start (the opening balance has always been there).
  const [openingDate, setOpeningDate] = useState<string | null>(null);
  const [repay, setRepayText] = useState('');
  const [repayCadence, setRepayCadence] = useState<RepayCadence>('monthly');
  // null: one step of the cadence from today; a date once the user picks one.
  const [repayPicked, setRepayPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) {
      return;
    }
    let live = true;
    getAccountById(accountId)
      .then(found => {
        if (!live || !found) {
          return;
        }
        setLoaded(found);
        setName(found.name);
        const foundClass = classOf(found.type);
        setAccountClass(foundClass);
        const label = kindLabelOf(found, t);
        setKind(label);
        setShownKind(label);
        // What is owed on a card or a loan is stored below zero; the form shows what is owed.
        setOpeningText(String(sideOf(foundClass) === 'owed' ? 0 - found.openingBalance : found.openingBalance));
        setOpeningDate(found.openingDate);
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [accountId, t]);

  // A card or a loan: what is owed is typed as the statement prints it, and the sign is ours to
  // apply (UX revamp v2: one missed minus sign used to turn a debt into savings).
  const owed = sideOf(accountClass) === 'owed';
  // Nothing typed is nothing held or owed: a new account may start at zero.
  const typedOpening = opening.trim() === '' ? 0 : parseSignedAmount(opening);
  const openingValue = owed ? 0 - typedOpening : typedOpening;
  // The user's own decimal mark, shown as it will be read (world review W5). What is owed takes no sign.
  const setOpening = useCallback(
    (text: string) => setOpeningText(owed ? normalizeAmountInput(text) : normalizeSignedAmountInput(text)),
    [owed],
  );
  const setRepay = useCallback((text: string) => setRepayText(normalizeAmountInput(text)), []);
  const repayAmount = repay.trim() === '' ? null : parseSignedAmount(repay);
  // A new loan's repayment is optional; given, it needs an amount above nothing.
  const asksRepay = !accountId && accountClass === 'loan' && recurringOn;
  const repayGiven = asksRepay && repayAmount !== null;
  const repayNext = repayPicked ?? shiftIsoDay(todayIsoDay(), REPAY_RULE[repayCadence].firstInDays);
  const repayValid = !repayGiven || (repayAmount !== null && Number.isFinite(repayAmount) && repayAmount > 0);
  const isValid =
    isValidAccountName(name) &&
    name.trim().length <= ACCOUNT_NAME_MAX &&
    isValidAccountKind(kind) &&
    Number.isFinite(openingValue) &&
    repayValid;

  const messageFor = useCallback(
    (error: unknown): string => {
      if (error instanceof AccountRuleError) {
        if (error.rule === 'nameTaken') {
          return t('accounts.nameTaken');
        }
        if (error.rule === 'nameNotValid') {
          return t('accounts.nameNotValid');
        }
      }
      return t('accounts.saveFailed');
    },
    [t],
  );

  /** The repeating transfer that pays a new loan, from the account new entries take when it is money to spend. */
  const setRepayRule = useCallback(
    async (loanId: string, amount: number): Promise<void> => {
      const spend = (await getAccounts(userId)).filter(account => account.active && classOf(account.type) === 'spend');
      const from = spend.find(account => account.isDefault) ?? spend[0];
      if (!from) {
        throw new Error('No account to repay from');
      }
      const {cadence, interval} = REPAY_RULE[repayCadence];
      await createRule(
        userId,
        {
          target: 'transfer',
          title: t('accounts.repayTitle', {name: name.trim()}),
          categoryId: '',
          accountId: from.id,
          toAccountId: loanId,
          amount,
          cadence,
          interval,
          startDate: repayNext,
          endDate: null,
          remindDaysBefore: null,
        },
        todayIsoDay(),
      );
    },
    [userId, name, t, repayCadence, repayNext],
  );

  const save = useCallback(async () => {
    if (!isValid || saving) {
      return;
    }
    setSaving(true);
    let createdId = '';
    try {
      const type = storedTypeFor(accountClass, kind);
      // The word a stored type already stands for is not stored again as the user's own.
      const ownKind =
        accountKindKey(kind) === accountKindKey(kindLabelOf({type, kind: ''}, t)) ? '' : cleanAccountKind(kind);
      const fields: AccountFields = {
        name,
        type,
        openingBalance: openingValue,
        openingDate,
        icon: loaded?.icon ?? ACCOUNT_TYPE_ICON[type],
        color: loaded?.color ?? '',
        kind: ownKind,
      };
      if (accountId && loaded) {
        const patch: Partial<AccountFields> = {};
        const classChanged = accountClass !== classOf(loaded.type);
        const kindChanged = accountKindKey(kind) !== accountKindKey(shownKind);
        if (fields.name.trim() !== loaded.name) patch.name = fields.name;
        // An unknown or old stored type is kept until the user changes what the account is.
        if ((classChanged || kindChanged) && type !== loaded.type) patch.type = type;
        if (classChanged || kindChanged) patch.kind = ownKind;
        if (fields.openingBalance !== loaded.openingBalance) patch.openingBalance = fields.openingBalance;
        if (fields.openingDate !== loaded.openingDate) patch.openingDate = fields.openingDate;
        await updateAccount(accountId, patch);
      } else {
        createdId = await createAccount(userId, fields);
      }
    } catch (error) {
      if (!(error instanceof AccountRuleError)) {
        appendErrorLog(error, false);
      }
      setSaving(false);
      await showAlert({type: 'error', message: messageFor(error)});
      return;
    }
    if (createdId && repayGiven && repayAmount !== null) {
      try {
        await setRepayRule(createdId, repayAmount);
      } catch (error) {
        // The loan is saved; only its repeating payment is not. Said plainly, and set from Coming up.
        appendErrorLog(error, false);
        setSaving(false);
        await showAlert({type: 'error', message: t('accounts.repayNotSet')});
        goBack();
        return;
      }
    }
    setSaving(false);
    goBack();
  }, [
    isValid,
    saving,
    accountClass,
    kind,
    shownKind,
    name,
    openingValue,
    openingDate,
    loaded,
    accountId,
    userId,
    showAlert,
    messageFor,
    repayGiven,
    repayAmount,
    setRepayRule,
    t,
  ]);

  return {
    isEditing: Boolean(accountId),
    ready: !accountId || loaded !== null,
    name,
    setName,
    accountClass,
    setAccountClass,
    kind,
    setKind,
    owed,
    opening,
    setOpening,
    openingDate,
    setOpeningDate,
    asksRepay,
    repay,
    setRepay,
    repayCadence,
    setRepayCadence,
    repayNext,
    setRepayNext: setRepayPicked,
    isValid,
    saving,
    save,
  };
};
