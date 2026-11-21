import {useCallback, useEffect, useMemo, useState} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {getAccounts, type AccountSummary} from '../../data/services/accountService';
import {appendErrorLog} from '../../platform/errorLog';
import {canPayFrom} from '../../domain/accounts';
import {useProFeature} from './useProFeature';

/**
 * The account row of the add and edit forms (expense, money in, refund;
 * ZERO_3.0_PRO.md §5). Collapsed, prefilled, and shown only with Pro and
 * more than one active account: in every other case it does not exist, so
 * Free and a one-account Pro user add an entry in exactly the taps 2.8 took.
 *
 * `chosen` is set only by the user's own pick. The save sends an account
 * only then: a new entry otherwise takes the default (the service decides),
 * and an edit otherwise leaves the stored account alone (law L6), which is
 * how a free edit never moves an entry off an account it cannot see.
 *
 * @param current The account the entry has now (an edit), or what a new one
 * starts on when it is not the default (a refund: its expense's). Undefined: the default.
 * @param preset An account already chosen for the user, by a Pro flow that opened
 * the form (reconcile's "Record what's missing"): sent like a pick.
 */
export const useEntryAccount = (current?: string | null, preset?: string) => {
  const pro = useProFeature('accounts');
  const userId = useAppSelector(selectUserId);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [chosen, setChosen] = useState<string | undefined>(preset);

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
      .catch((error: unknown) => {
        // Without the list the row stays hidden and the entry takes its usual account: nothing is lost.
        appendErrorLog(error, false);
      });
    return () => {
      live = false;
    };
  }, [pro, userId]);

  // An entry is paid from money to spend or from a card; never from a loan or from savings (approved A2).
  const active = useMemo(() => accounts.filter(account => account.active && canPayFrom(account.type)), [accounts]);
  const selectedId = chosen ?? current ?? accounts.find(account => account.isDefault)?.id;
  // The entry's own account may be archived: it is shown by name, and not offered for a move.
  const selected = accounts.find(account => account.id === selectedId);

  const pick = useCallback(() => {
    void SheetManager.show('account-picker-sheet', {
      payload: {accounts: active, selectedId, onSelect: setChosen},
    });
  }, [active, selectedId]);

  return {
    shown: pro && active.length > 1,
    selected,
    pick,
    /** What the save passes on: an account only when the user picked one. */
    chosen: pro ? chosen : undefined,
  };
};
