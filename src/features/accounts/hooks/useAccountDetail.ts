import {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {
  AccountRuleError,
  getAccountById,
  setAccountArchived,
  setDefaultAccount,
  type AccountRecord,
} from '../../../data/services/accountService';
import {
  getAccountBalance,
  getAccountMonth,
  type AccountBalance,
  type AccountEntry,
} from '../../../data/services/netWorthService';
import {deleteCheckpoint} from '../../../data/services/checkpointService';
import {formatDate} from '../../../domain/dates';
import {periodFor} from '../../../domain/period';
import {useMonthStartDay} from '../../../ui/hooks/useMonthStartDay';
import {displayAccountName} from '../../../i18n/displayNames';
import {appendErrorLog} from '../../../platform/errorLog';
import {useDialog} from '../../../ui/context/DialogContext';
import {useFreshWhileFocused} from '../../../ui/hooks/useFreshWhileFocused';
import {useMonthNavigation} from '../../../ui/hooks/useMonthNavigation';
import {POSITION_TABLES} from '../../../ui/hooks/useNetWorth';

/**
 * One account: its balance today, the day it is anchored to, and one month
 * of everything on it (entries, refunds, transfers, debts, balances set),
 * newest first. Archive, restore and "make default" act here.
 */
export const useAccountDetail = (accountId: string) => {
  const {t} = useTranslation();
  const {showAlert, showDialog} = useDialog();
  const userId = useAppSelector(selectUserId);
  const month = useMonthNavigation({shared: false});
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [missing, setMissing] = useState(false);
  const request = useRef(0);
  const {yearMonth} = month;
  // The account's month is the user's month (P11): the same days Home and Money show under this name.
  const monthStartDay = useMonthStartDay();
  const period = useMemo(() => periodFor(yearMonth, monthStartDay), [yearMonth, monthStartDay]);

  const read = useCallback(() => {
    if (!userId) {
      return;
    }
    const mine = ++request.current;
    Promise.all([
      getAccountById(accountId),
      getAccountBalance(userId, accountId, formatDate(undefined)),
      getAccountMonth(userId, accountId, period),
    ])
      .then(([found, nextBalance, nextEntries]) => {
        if (mine !== request.current) {
          return;
        }
        setMissing(found === null);
        setAccount(found);
        setBalance(nextBalance);
        setEntries(nextEntries);
      })
      .catch((error: unknown) => {
        appendErrorLog(error, false);
        if (mine === request.current) {
          setMissing(true);
        }
      });
  }, [userId, accountId, period]);

  useFreshWhileFocused(read, POSITION_TABLES);

  const makeDefault = useCallback(async () => {
    if (!account) {
      return;
    }
    try {
      await setDefaultAccount(account.id);
      await showAlert({
        type: 'success',
        message: t('accounts.defaultSet', {name: displayAccountName(account.name, t)}),
      });
    } catch (error) {
      appendErrorLog(error, false);
      await showAlert({type: 'error', message: t('accounts.saveFailed')});
    }
  }, [account, showAlert, t]);

  const toggleArchived = useCallback(async () => {
    if (!account) {
      return;
    }
    if (account.active) {
      if (account.isDefault) {
        await showAlert({type: 'info', message: t('accounts.defaultCannotBeArchived')});
        return;
      }
      const confirmed = await showDialog({
        type: 'warning',
        message: t('accounts.archiveConfirm', {name: displayAccountName(account.name, t)}),
      });
      if (!confirmed) {
        return;
      }
    }
    try {
      await setAccountArchived(account.id, account.active);
    } catch (error) {
      const message =
        error instanceof AccountRuleError && error.rule === 'defaultCannotBeArchived'
          ? t('accounts.defaultCannotBeArchived')
          : t('accounts.saveFailed');
      appendErrorLog(error, false);
      await showAlert({type: 'error', message});
    }
  }, [account, showAlert, showDialog, t]);

  const removeCheckpoint = useCallback(
    async (checkpointId: string) => {
      if (!(await showDialog({type: 'warning', message: t('accounts.removeCheckpointConfirm')}))) {
        return;
      }
      try {
        await deleteCheckpoint(checkpointId);
      } catch (error) {
        appendErrorLog(error, false);
        await showAlert({type: 'error', message: t('accounts.deleteFailed')});
      }
    },
    [showAlert, showDialog, t],
  );

  return {account, balance, entries, missing, month, period, makeDefault, toggleArchived, removeCheckpoint};
};
