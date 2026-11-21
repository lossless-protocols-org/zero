import {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {ParseKeys, TFunction} from 'i18next';
import {useAppSelector} from '../../store/hooks';
import {selectUserId} from '../../store/slices/userIdSlice';
import {getAccounts, renameAccountKind, type AccountSummary} from '../../data/services/accountService';
import type {WatchedTable} from '../../data/services/tableChanges';
import {accountKindKey, classOf, type AccountClass} from '../../domain/accounts';
import {appendErrorLog} from '../../platform/errorLog';
import {kindLabelOf} from '../accountWords';
import {useFreshWhileFocused} from './useFreshWhileFocused';

/**
 * The groups the app suggests under each class (approved list, 2026-11-14):
 * built-in words first. The user may type any other. A word with no stored
 * type of its own (domain/accounts.storedTypeFor) is stored as the user's own.
 */
const SUGGESTED_GROUPS: Record<AccountClass, readonly ParseKeys[]> = {
  spend: ['accounts.typeBank', 'accounts.typeCash', 'accounts.typeWallet'],
  save: [
    'accounts.kindDeposit',
    'accounts.kindFunds',
    'accounts.kindStocks',
    'accounts.kindGold',
    'accounts.kindPension',
  ],
  card: ['accounts.kindCredit', 'accounts.kindLater', 'accounts.kindOverdraft'],
  loan: ['accounts.kindHome', 'accounts.kindVehicle', 'accounts.kindStudy', 'accounts.kindPersonal'],
};

/** One group of accounts inside a class. */
export interface AccountGroup {
  /** `accountKindKey(label)`: two spellings of one word are one group. */
  key: string;
  label: string;
  /** Active accounts in it; 0 for a suggestion no account uses. */
  count: number;
}

const ACCOUNT_TABLES: readonly WatchedTable[] = ['accounts'];

interface Grouped {
  byClass: Record<AccountClass, readonly AccountGroup[]>;
  /** Every account of a group, archived ones included, by class and key: who a rename reaches. */
  members: ReadonlyMap<string, readonly string[]>;
}

const memberKey = (accountClass: AccountClass, key: string): string => `${accountClass}:${key}`;

const groupAccounts = (accounts: readonly AccountSummary[], t: TFunction): Grouped => {
  const members = new Map<string, string[]>();
  const used: Record<AccountClass, AccountGroup[]> = {spend: [], save: [], card: [], loan: []};
  for (const account of accounts) {
    const label = kindLabelOf(account, t);
    if (!label) {
      continue;
    }
    const accountClass = classOf(account.type);
    const key = accountKindKey(label);
    const ids = members.get(memberKey(accountClass, key)) ?? [];
    ids.push(account.id);
    members.set(memberKey(accountClass, key), ids);
    if (!account.active) {
      continue;
    }
    const found = used[accountClass].find(group => group.key === key);
    if (found) {
      found.count += 1;
    } else {
      used[accountClass].push({key, label, count: 1});
    }
  }
  const forClass = (accountClass: AccountClass): AccountGroup[] => {
    // Most accounts first; the sort is stable, so equal groups keep the user's own account order.
    const inUse = [...used[accountClass]].sort((a, b) => b.count - a.count);
    const taken = new Set(inUse.map(group => group.key));
    const suggested = SUGGESTED_GROUPS[accountClass]
      .map((word): AccountGroup => {
        const label: string = t(word);
        return {key: accountKindKey(label), label, count: 0};
      })
      .filter(group => !taken.has(group.key));
    return [...inUse, ...suggested];
  };
  return {
    byClass: {spend: forClass('spend'), save: forClass('save'), card: forClass('card'), loan: forClass('loan')},
    members,
  };
};

/**
 * The groups of the user's accounts, by class (Pro, held-and-owed model):
 * what the Categories tab lists and renames, and what the account form
 * offers. An account's group is its label (ui/accountWords.kindLabelOf): the
 * user's own word, else the word its stored type stands for; an account with
 * neither is in no group. Read while the screen is focused and again after
 * every write to the accounts.
 */
export const useAccountGroups = (): {
  ready: boolean;
  /** Groups in use per class, most accounts first, then the suggested ones not in use (count 0). */
  byClass: Record<AccountClass, readonly AccountGroup[]>;
  /** Renames a group on every account of that class that has it. Rejects an invalid or empty name. */
  rename: (accountClass: AccountClass, from: AccountGroup, toLabel: string) => Promise<void>;
  refresh: () => void;
} => {
  const {t} = useTranslation();
  const userId = useAppSelector(selectUserId);
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const request = useRef(0);

  const refresh = useCallback(() => {
    if (!userId) {
      return;
    }
    const mine = ++request.current;
    getAccounts(userId)
      .then(found => {
        // Only the newest read lands: an older one finishing late would bring a renamed group back.
        if (mine === request.current) {
          setAccounts(found);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
  }, [userId]);

  useFreshWhileFocused(refresh, ACCOUNT_TABLES);

  const {byClass, members} = useMemo(() => groupAccounts(accounts ?? [], t), [accounts, t]);

  const rename = useCallback(
    (accountClass: AccountClass, from: AccountGroup, toLabel: string): Promise<void> =>
      // The accounts under the row as it was shown; the write is followed like any other (useFreshWhileFocused).
      renameAccountKind(userId, accountClass, members.get(memberKey(accountClass, from.key)) ?? [], toLabel),
    [userId, members],
  );

  return {ready: accounts !== null, byClass, rename, refresh};
};
