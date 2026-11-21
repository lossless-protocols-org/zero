import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {getAccountById, type AccountRecord} from '../../../data/services/accountService';
import {acceptCheckpoint, previewCheckpoint, type CheckpointPreview} from '../../../data/services/checkpointService';
import {getISODateTime, isIsoDay, toDayKey} from '../../../domain/dates';
import {goBack, navigate} from '../../../platform/navigationUtils';
import {setIncomeDraft, setQuickAddDraft} from '../../../ui/quickAddDraft';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {POSITION_TABLES} from '../../../ui/hooks/useNetWorth';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';
import {parseSignedAmount} from '../accountCopy';
import {normalizeSignedAmountInput} from '../../../domain/amountInput';
import {classOf, isOwedType} from '../../../domain/accounts';

/**
 * Reconciling (ZERO_3.0_PRO.md §5): the user types what the account really
 * held at the end of a day; zero shows what the entries give and the gap,
 * then records the balance. The entries are never changed. The gap shown is
 * worked out again when saving, against the rows as they are then.
 */
export const useReconcile = (accountId: string) => {
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const userId = useAppSelector(selectUserId);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [balance, setBalanceText] = useState('');
  // The user's own decimal mark, shown as it will be read (world review W5).
  const setBalance = useCallback((text: string) => setBalanceText(normalizeSignedAmountInput(text)), []);
  const [pickerDate, setPickerDate] = useState(getISODateTime());
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<CheckpointPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    let live = true;
    getAccountById(accountId)
      .then(found => {
        if (live) {
          setAccount(found);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [accountId]);

  // A card: the user types what is owed, as the statement prints it, and the sign is ours to
  // apply. Asking for a minus sign turned debts into savings with one missed key (UX revamp v2).
  const owes = account !== null && isOwedType(account.type);
  const typed = parseSignedAmount(balance);
  const value = owes ? -typed : typed;
  const day = toDayKey(pickerDate);
  // Worked out again when the screen comes back into view, or the rows change under it
  // (an entry recorded through "Record what's missing").
  const [freshness, setFreshness] = useState(0);
  const refresh = useCallback(() => setFreshness(n => n + 1), []);
  useFreshWhileFocused(refresh, POSITION_TABLES);

  useEffect(() => {
    // Every change of input makes any read still in flight stale, the invalid ones included.
    const mine = ++request.current;
    if (!userId || !isIsoDay(day) || !Number.isFinite(value)) {
      setPreview(null);
      return;
    }
    previewCheckpoint(userId, accountId, value, day)
      .then(next => {
        if (mine === request.current) {
          setPreview(next);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [userId, accountId, value, day, freshness]);

  const isValid = account !== null && Number.isFinite(value) && isIsoDay(day);

  const save = useCallback(async () => {
    if (!isValid || saving || !isIsoDay(day)) {
      return;
    }
    setSaving(true);
    try {
      await acceptCheckpoint(userId, {accountId, balance: value, date: day, note: note.trim()});
    } catch (error) {
      appendErrorLog(error, false);
      setSaving(false);
      await showAlert({type: 'error', message: t('accounts.reconcileFailed')});
      return;
    }
    setSaving(false);
    goBack();
  }, [isValid, saving, day, userId, accountId, value, note, showAlert, t]);

  /**
   * "Record what's missing" (ZERO_3.0_PRO.md §5): a gap on a cash or bank
   * account is usually an entry never made. This opens the ordinary add form,
   * filled in with the gap, the day and this account; the entry is written by
   * the usual service, and the gap shown here shrinks when the user comes back.
   * Not offered on an investment, where a gap is a value change.
   */
  const canRecordMissing =
    account !== null && classOf(account.type) !== 'save' && preview !== null && preview.gap !== 0 && isIsoDay(day);
  /**
   * A card or a loan that the lender says is owed more than the entries give: the gap is
   * interest or a fee, an expense charged to the debt (approved A4), never an adjustment.
   */
  const gapIsInterest = canRecordMissing && owes && preview !== null && preview.gap < 0;
  const recordMissing = useCallback(() => {
    if (!canRecordMissing || !preview) {
      return;
    }
    const amount = String(Math.abs(preview.gap));
    if (preview.gap < 0) {
      // Less in the account than the entries say: money went out that was never entered.
      setQuickAddDraft({
        title: gapIsInterest ? t('accounts.interestTitle') : '',
        amount,
        categoryId: '',
        date: `${day}T12:00:00`,
        accountId,
      });
      navigate('AddTransactionsScreen');
    } else {
      setIncomeDraft({amount, date: day, accountId});
      navigate('AddIncomeScreen', {});
    }
  }, [canRecordMissing, preview, day, accountId, gapIsInterest, t]);

  return {
    account,
    owes,
    balance,
    setBalance,
    pickerDate,
    setPickerDate,
    note,
    setNote,
    preview,
    isValid,
    saving,
    save,
    canRecordMissing,
    gapIsInterest,
    recordMissing,
  };
};
