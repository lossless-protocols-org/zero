import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {getAccounts, type AccountSummary} from '../../data/services/accountService';
import {appendErrorLog} from '../../platform/errorLog';
import {canPayFrom} from '../../domain/accounts';
import {useProFeature} from './useProFeature';

/**
 * The account row of the debt form (3.0, Pro): which account the money moved
 * through, or none. Unlike an entry, a debt starts on NO account, as every
 * debt before 3.0: lending cash from your pocket is a choice, not a default.
 * Hidden without Pro; then the save sends nothing and an edit keeps the
 * account it has (L6).
 *
 * `chosen`: undefined until the user picks; null for "No account".
 */
export const useDebtAccount = (current: string | null | undefined) => {
  const {t} = useTranslation();
  const pro = useProFeature('accounts');
  const userId = useAppSelector(selectUserId);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!pro || !userId) {
      return;
    }
    let live = true;
    getAccounts(userId)
      .then(found => {
        if (live) {
          setAccounts(found);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [pro, userId]);

  // Lent or borrowed through money to spend or through a card (a friend used it); never a loan or savings.
  const active = useMemo(() => accounts.filter(account => account.active && canPayFrom(account.type)), [accounts]);
  const selectedId = chosen === undefined ? (current ?? null) : chosen;
  const pick = useCallback(() => {
    void SheetManager.show('account-picker-sheet', {
      payload: {
        accounts: active,
        selectedId: selectedId ?? '',
        noneLabel: t('accounts.noAccount'),
        // '' is the sheet's "No account" row.
        onSelect: (id: string) => setChosen(id === '' ? null : id),
      },
    });
  }, [active, selectedId, t]);

  return {
    shown: pro && active.length > 0,
    selected: accounts.find(account => account.id === selectedId),
    emptyLabel: t('accounts.noAccount'),
    pick,
    /** What the save passes on: undefined unless the user picked (null: no account). */
    chosen: pro ? chosen : undefined,
  };
};
