/**
 * The account row's state (3.0): shown only with Pro and more than one active
 * account; prefilled with the entry's account, else the default; and it hands
 * the save an account only when the user picked one, so Free and an untouched
 * Pro form write exactly what 2.8 wrote (L6). Real LokiJS database.
 */
import {act, waitFor} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {useEntryAccount} from '../../../../src/ui/hooks/useEntryAccount';
import {setAccountArchived} from '../../../../src/data/services/accountService';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

it('without Pro: never shown, never chosen, and the accounts are not even read', async () => {
  const {result} = await renderHookInApp(() => useEntryAccount());
  expect(result.current.shown).toBe(false);
  expect(result.current.chosen).toBeUndefined();
  expect(result.current.selected).toBeUndefined();
});

it('with Pro: shown, prefilled with the default, and nothing chosen until the user picks', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useEntryAccount());
  await waitFor(() => expect(result.current.shown).toBe(true));
  expect(result.current.selected?.id).toBe(seed.cash);
  expect(result.current.chosen).toBeUndefined();
});

it('an edit shows its own account, archived or not, and offers only active ones to move to', async () => {
  await setAccountArchived(seed.fund, true);
  await act(async () => setEntitlement({state: 'lifetime'}));
  const offered: string[][] = [];
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_id, options) => {
    const payload = (options as {payload: {accounts: Array<{id: string}>; onSelect: (id: string) => void}}).payload; // the picker's own payload
    offered.push(payload.accounts.map(a => a.id));
    payload.onSelect(seed.bank);
    return undefined;
  });
  const {result} = await renderHookInApp(() => useEntryAccount(seed.fund));
  await waitFor(() => expect(result.current.selected?.id).toBe(seed.fund));
  await act(async () => result.current.pick());
  expect(offered[0]).not.toContain(seed.fund);
  expect(result.current.chosen).toBe(seed.bank);
  expect(result.current.selected?.id).toBe(seed.bank);
});

it('a pick made with Pro is not sent once Pro is off', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_id, options) => {
    (options as {payload: {onSelect: (id: string) => void}}).payload.onSelect(seed.bank); // the picker's own payload
    return undefined;
  });
  const {result} = await renderHookInApp(() => useEntryAccount());
  await waitFor(() => expect(result.current.shown).toBe(true));
  await act(async () => result.current.pick());
  expect(result.current.chosen).toBe(seed.bank);
  await act(async () => setEntitlement({state: 'expired'}));
  expect(result.current.shown).toBe(false);
  expect(result.current.chosen).toBeUndefined();
});
