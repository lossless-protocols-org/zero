/**
 * The groups of the user's accounts, by class (Pro, held-and-owed model): the
 * ones in use first, most accounts first, then the suggested ones nobody
 * uses; a rename reaches every account of the group in that class, archived
 * ones included, and the list follows the write. Real LokiJS database.
 */
import type {TFunction} from 'i18next';
import {act, waitFor} from '@testing-library/react-native';
import en from '../../../../src/i18n/locales/en.json';
import {useAccountGroups} from '../../../../src/ui/hooks/useAccountGroups';
import {kindLabelOf} from '../../../../src/ui/accountWords';
import * as accountService from '../../../../src/data/services/accountService';
import {
  AccountRuleError,
  createAccount,
  getAccountById,
  setAccountArchived,
} from '../../../../src/data/services/accountService';
import {
  ACCOUNT_CLASSES,
  accountKindKey,
  classOf,
  isValidAccountKind,
  storedTypeFor,
  type AccountClass,
} from '../../../../src/domain/accounts';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../harness/mocks/focusEffect'),
}));

/** The English words of the accounts block, by full key. */
const WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(en.accounts).flatMap(([key, text]) => (typeof text === 'string' ? [[`accounts.${key}`, text]] : [])),
);
const english = ((key: string) => WORDS[key] ?? key) as unknown as TFunction; // stands in for i18next's t: only plain keys are asked for

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  setMockTranslations(WORDS);
});
afterEach(() => setMockTranslations({}));

/** Lets the read that follows a write land inside act. */
const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));

const saving = (name: string, kind: string) =>
  createAccount(seed.userId, {
    name,
    type: 'investment',
    openingBalance: 0,
    openingDate: null,
    icon: 'trending-up',
    color: '#224466',
    kind,
  });

describe('the suggested groups', () => {
  /** Every word the hook offers under a class: with these accounts, the suggestions (one or two of them in use). */
  const offered = async () => {
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    return (accountClass: AccountClass) => result.current.byClass[accountClass].map(group => group.label);
  };

  it('are the approved words, in order', async () => {
    const words = await offered();
    // Cash and Bank are in use (the seed), so they lead; the rest keep the list's order.
    expect(words('spend')).toEqual(['Cash', 'Bank', 'Wallet']);
    expect(words('save')).toEqual(['Deposit', 'Funds', 'Stocks', 'Gold', 'Pension']);
    expect(words('card')).toEqual(['Credit', 'Later', 'Overdraft']);
    expect(words('loan')).toEqual(['Home', 'Vehicle', 'Study', 'Personal']);
  });

  it('each is one valid word, once per class, and is read back as itself however it is stored', async () => {
    const words = await offered();
    for (const accountClass of ACCOUNT_CLASSES) {
      expect(new Set(words(accountClass).map(accountKindKey)).size).toBe(words(accountClass).length);
      for (const word of words(accountClass)) {
        expect(word).not.toMatch(/^accounts\./);
        expect(isValidAccountKind(word)).toBe(true);
        const type = storedTypeFor(accountClass, word);
        expect(classOf(type)).toBe(accountClass);
        // As the form stores it: a word the stored type already stands for is not stored again;
        // any other (Study, Pension, Overdraft) is kept as the user's own.
        const builtIn = kindLabelOf({type, kind: ''}, english);
        const own = accountKindKey(builtIn) === accountKindKey(word) ? '' : word;
        expect(kindLabelOf({type, kind: own}, english)).toBe(word);
      }
    }
  });

  it('a new suggestion has no stored type of its own: it is the user’s own word on the class’s type', () => {
    expect(storedTypeFor('card', 'Overdraft')).toBe('card');
    expect(kindLabelOf({type: 'card', kind: ''}, english)).toBe('Credit');
    expect(storedTypeFor('loan', 'Study')).toBe('loan');
    expect(storedTypeFor('save', 'Pension')).toBe('investment');
    expect(kindLabelOf({type: 'loan', kind: ''}, english)).toBe('');
    expect(kindLabelOf({type: 'investment', kind: ''}, english)).toBe('');
  });
});

describe('useAccountGroups', () => {
  it('lists the groups in use, then the suggested ones no account uses', async () => {
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    // The default account is cash and HDFC a bank: neither has a word of its own, so each reads as its type's.
    expect(result.current.byClass.spend).toEqual([
      {key: 'cash', label: 'Cash', count: 1},
      {key: 'bank', label: 'Bank', count: 1},
      {key: 'wallet', label: 'Wallet', count: 0},
    ]);
    expect(result.current.byClass.card).toEqual([
      {key: 'credit', label: 'Credit', count: 1},
      {key: 'later', label: 'Later', count: 0},
      {key: 'overdraft', label: 'Overdraft', count: 0},
    ]);
    // The seeded fund has no group: only suggestions.
    expect(result.current.byClass.save.map(group => [group.label, group.count])).toEqual([
      ['Deposit', 0],
      ['Funds', 0],
      ['Stocks', 0],
      ['Gold', 0],
      ['Pension', 0],
    ]);
    expect(result.current.byClass.loan.map(group => group.label)).toEqual(['Home', 'Vehicle', 'Study', 'Personal']);
  });

  it('counts active accounts, one group however the word is spelled, most accounts first', async () => {
    await saving('PPF', 'Retirement');
    await saving('Bond', 'Gold');
    await saving('Coins', ' gold ');
    const archived = await saving('Old fund', 'Funds');
    await setAccountArchived(archived, true);
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.byClass.save.slice(0, 2)).toEqual([
      {key: 'gold', label: 'Gold', count: 2},
      {key: 'retirement', label: 'Retirement', count: 1},
    ]);
    // Only an archived account uses Funds: it is offered like any suggestion, and Gold is not listed twice.
    expect(result.current.byClass.save.slice(2).map(group => [group.label, group.count])).toEqual([
      ['Deposit', 0],
      ['Funds', 0],
      ['Stocks', 0],
      ['Pension', 0],
    ]);
  });

  it('renames a group on every account of that class in it, and the list follows', async () => {
    const bond = await saving('Bond', 'Gold');
    const coins = await saving('Coins', 'gold');
    await setAccountArchived(coins, true);
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.byClass.save[0]?.key).toBe('gold'));
    const gold = result.current.byClass.save[0]!; // just waited for
    await act(() => result.current.rename('save', gold, ' Metal '));
    await settle();
    await waitFor(() => expect(result.current.byClass.save[0]).toEqual({key: 'metal', label: 'Metal', count: 1}));
    expect((await getAccountById(bond))?.kind).toBe('Metal');
    // The archived one follows too: restored, it must not bring the old word back.
    expect((await getAccountById(coins))?.kind).toBe('Metal');
    // Gold is a suggestion again.
    expect(result.current.byClass.save.some(group => group.key === 'gold' && group.count === 0)).toBe(true);
  });

  it('renames a group that reads as its stored type’s word, in its own class only', async () => {
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const cash = result.current.byClass.spend.find(group => group.key === 'cash')!; // listed above
    await act(() => result.current.rename('spend', cash, 'Pocket'));
    await settle();
    expect(await getAccountById(seed.cash)).toMatchObject({kind: 'Pocket', type: 'cash'});
    expect((await getAccountById(seed.bank))?.kind).toBe('');
    expect((await getAccountById(seed.card))?.kind).toBe('');
  });

  it('rejects an empty or over-long name and changes nothing', async () => {
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const cash = result.current.byClass.spend.find(group => group.key === 'cash')!; // listed above
    await expect(result.current.rename('spend', cash, '  ')).rejects.toBeInstanceOf(AccountRuleError);
    await expect(result.current.rename('spend', cash, 'x'.repeat(21))).rejects.toBeInstanceOf(AccountRuleError);
    expect((await getAccountById(seed.cash))?.kind).toBe('');
  });

  it('reads again when asked', async () => {
    const {result} = await renderHookInApp(() => useAccountGroups());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const read = jest.spyOn(accountService, 'getAccounts');
    await act(async () => result.current.refresh());
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(seed.userId);
    read.mockRestore();
  });
});
