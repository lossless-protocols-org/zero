/**
 * The debt form's account row (3.0, Pro): a new debt starts on no account; the
 * picker offers "No account" first; nothing is sent until the user picks, and
 * nothing at all without Pro (L6).
 */
import {act, waitFor} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {useDebtAccount} from '../../../../src/ui/hooks/useDebtAccount';
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

const answer = (id: string) =>
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_sheet, options) => {
    (options as {payload: {onSelect: (picked: string) => void; noneLabel?: string}}).payload.onSelect(id); // the picker's own payload
    return undefined;
  });

it('without Pro: hidden, and nothing is sent', async () => {
  const {result} = await renderHookInApp(() => useDebtAccount(seed.bank));
  expect(result.current.shown).toBe(false);
  expect(result.current.chosen).toBeUndefined();
});

it('with Pro: a new debt starts on no account; picking one sends it; "No account" sends null', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const show = answer(seed.bank);
  const {result} = await renderHookInApp(() => useDebtAccount(undefined));
  await waitFor(() => expect(result.current.shown).toBe(true));
  expect(result.current.selected).toBeUndefined();
  expect(result.current.emptyLabel).toBe('accounts.noAccount');
  await act(async () => result.current.pick());
  expect((show.mock.calls[0]?.[1] as {payload: {noneLabel?: string}}).payload.noneLabel).toBe('accounts.noAccount');
  expect(result.current.chosen).toBe(seed.bank);
  show.mockRestore();
  answer('');
  await act(async () => result.current.pick());
  expect(result.current.chosen).toBeNull();
});

it('an edit shows the debt’s own account', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useDebtAccount(seed.card));
  await waitFor(() => expect(result.current.selected?.id).toBe(seed.card));
  expect(result.current.chosen).toBeUndefined();
});
