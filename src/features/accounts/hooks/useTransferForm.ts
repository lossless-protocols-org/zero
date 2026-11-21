import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {selectCurrencyCode} from '../../../store/slices/currencyDataSlice';
import {getAccounts, type AccountSummary} from '../../../data/services/accountService';
import {
  TransferRuleError,
  createTransfer,
  deleteTransfer,
  getTransferById,
  updateTransfer,
  type TransferData,
} from '../../../data/services/transferService';
import {createAmountSchema, expenseDescriptionSchema} from '../../../i18n/validationSchema';
import {getISODateTime, isIsoDay, toDayKey} from '../../../domain/dates';
import {goBack} from '../../../platform/navigationUtils';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';

/**
 * Money moved between two of the user's accounts: an SIP, a card bill, cash
 * from an ATM. A position change, never spending or money in (R14). An edit
 * sends only what changed (L6).
 */
export interface TransferStart {
  fromAccountId?: string;
  /** With `amount`: paying a card's bill starts with the card and what is owed filled in. */
  toAccountId?: string;
  amount?: number;
}

export const useTransferForm = (transferId?: string, start: TransferStart = {}) => {
  const {fromAccountId, toAccountId, amount: startAmount} = start;
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const userId = useAppSelector(selectUserId);
  const currencyCode = useAppSelector(selectCurrencyCode);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [editing, setEditing] = useState<TransferData | null>(null);
  const [from, setFrom] = useState<string | undefined>(fromAccountId);
  const [to, setTo] = useState<string | undefined>(toAccountId);
  const [amount, setAmount] = useState(startAmount && startAmount > 0 ? String(startAmount) : '');
  const [pickerDate, setPickerDate] = useState(getISODateTime());
  const [note, setNote] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let live = true;
    Promise.all([getAccounts(userId), transferId ? getTransferById(transferId) : Promise.resolve(null)])
      .then(([found, transfer]) => {
        if (!live) {
          return;
        }
        setAccounts(found);
        setLoaded(true);
        if (transfer) {
          setEditing(transfer);
          setFrom(transfer.fromAccountId);
          setTo(transfer.toAccountId);
          setAmount(String(transfer.amount));
          setPickerDate(`${transfer.date}T09:00:00`);
          setNote(transfer.note);
          return;
        }
        // A new transfer starts from the account it was opened on, else the default, to the next active one.
        const active = found.filter(account => account.active);
        // Paying a bill: the money comes from the default account, or the first that is not the card itself.
        const others = active.filter(account => account.id !== toAccountId);
        const first = fromAccountId ?? others.find(account => account.isDefault)?.id ?? others[0]?.id;
        setFrom(first);
        setTo(toAccountId ?? active.find(account => account.id !== first)?.id);
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [userId, transferId, fromAccountId, toAccountId]);

  const active = useMemo(() => accounts.filter(account => account.active), [accounts]);
  const byId = useCallback((id: string | undefined) => accounts.find(account => account.id === id), [accounts]);

  const pickFrom = useCallback(() => {
    void SheetManager.show('account-picker-sheet', {payload: {accounts: active, selectedId: from, onSelect: setFrom}});
  }, [active, from]);
  const pickTo = useCallback(() => {
    void SheetManager.show('account-picker-sheet', {payload: {accounts: active, selectedId: to, onSelect: setTo}});
  }, [active, to]);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  const amountSchema = useMemo(() => createAmountSchema(currencyCode), [currencyCode]);
  const schemaIssues = amountSchema.issues(Number(amount));
  const amountErrors = hasInteracted ? schemaIssues.map(issue => issue.message) : [];
  const day = toDayKey(pickerDate);
  const sameAccount = from !== undefined && from === to;
  // An edit whose transfer is gone (deleted elsewhere) must not save as a new one.
  const missing = Boolean(transferId) && loaded && editing === null;
  const isValid =
    !missing &&
    (!transferId || editing !== null) &&
    schemaIssues.length === 0 &&
    from !== undefined &&
    to !== undefined &&
    !sameAccount &&
    isIsoDay(day) &&
    expenseDescriptionSchema.isValid(note);

  const messageFor = useCallback(
    (error: unknown): string =>
      error instanceof TransferRuleError && error.rule === 'sameAccount'
        ? t('accounts.sameAccount')
        : t('accounts.transferFailed'),
    [t],
  );

  const save = useCallback(async () => {
    if (!isValid || saving || !from || !to || !isIsoDay(day)) {
      return;
    }
    setSaving(true);
    try {
      const value = Number(amount);
      if (editing) {
        await updateTransfer(editing.id, {
          ...(from === editing.fromAccountId ? {} : {fromAccountId: from}),
          ...(to === editing.toAccountId ? {} : {toAccountId: to}),
          ...(value === editing.amount ? {} : {amount: value}),
          ...(day === editing.date ? {} : {date: day}),
          ...(note.trim() === editing.note ? {} : {note: note.trim()}),
        });
      } else {
        await createTransfer(userId, {
          fromAccountId: from,
          toAccountId: to,
          amount: value,
          date: day,
          note: note.trim(),
        });
      }
    } catch (error) {
      if (!(error instanceof TransferRuleError)) {
        appendErrorLog(error, false);
      }
      setSaving(false);
      await showAlert({type: 'error', message: messageFor(error)});
      return;
    }
    setSaving(false);
    goBack();
  }, [isValid, saving, from, to, day, amount, editing, note, userId, showAlert, messageFor]);

  const remove = useCallback(async () => {
    if (!editing) {
      return;
    }
    if (!(await showDialog({type: 'warning', message: t('accounts.deleteTransferConfirm')}))) {
      return;
    }
    try {
      await deleteTransfer(editing.id);
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('accounts.deleteFailed')});
      return;
    }
    goBack();
  }, [editing, showDialog, showAlert, t]);

  return {
    isEditing: Boolean(transferId),
    missing,
    from: byId(from),
    to: byId(to),
    pickFrom,
    pickTo,
    swap,
    /** The amount as a number once it is a valid one; null while it is not. */
    value: schemaIssues.length === 0 ? Number(amount) : null,
    sameAccount,
    amount,
    setAmount,
    amountErrors,
    onAmountBlur: () => setHasInteracted(true),
    pickerDate,
    setPickerDate,
    note,
    setNote,
    isValid,
    saving,
    save,
    remove,
  };
};
