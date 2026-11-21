/**
 * Opening an entry (P9): with Pro, an entry a rule made asks "this one or the
 * rule?", and a stray backdrop tap opens just the entry; without Pro, or for
 * an entry entered by hand, or whose rule is gone, the entry opens at once.
 */
import {act} from '@testing-library/react-native';
import {useOpenEntry} from '../../../../src/ui/hooks/useOpenEntry';
import {navigate} from '../../../../src/platform/navigationUtils';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../harness/mocks/dialogs';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';
import {seedAccounts} from '../../../harness/accountsSeed';
import {seedRule} from '../../../harness/recurringSeed';
import {renderHookInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
jest.mock('../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../src/ui/context/DialogContext', () =>
  require('../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let rule = '';
beforeEach(async () => {
  rule = await seedRule(await seedAccounts());
  resetDialogs();
  jest.mocked(navigate).mockClear();
});
afterEach(async () => {
  await act(async () => resetEntitlement());
});

it('without Pro, a made entry opens like any other, and shows no mark', async () => {
  const {result} = await renderHookInApp(() => useOpenEntry());
  expect(result.current.showsRepeat).toBe(false);
  await act(() => result.current.openExpense({id: 'e1', recurringId: rule}));
  expect(dialogsSaid()).toEqual([]);
  expect(navigate).toHaveBeenCalledWith('UpdateTransactionScreen', {expenseId: 'e1'});
});

it('with Pro: asks, and the answer decides; "no" (or a backdrop tap) is just this one', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useOpenEntry());
  answerNextDialog(true);
  await act(() => result.current.openIncome({id: 'i1', recurringId: rule}));
  expect(navigate).toHaveBeenLastCalledWith('RuleFormScreen', {ruleId: rule});
  answerNextDialog(false);
  await act(() => result.current.openIncome({id: 'i1', recurringId: rule}));
  expect(navigate).toHaveBeenLastCalledWith('UpdateIncomeScreen', {incomeId: 'i1'});
  expect(dialogsSaid()).toEqual(['info: recurring.editWhich', 'info: recurring.editWhich']);
});

it('with Pro: an entry entered by hand, or whose rule is gone, opens at once', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  const {result} = await renderHookInApp(() => useOpenEntry());
  await act(() => result.current.openExpense({id: 'e1', recurringId: null}));
  await act(() => result.current.openExpense({id: 'e2', recurringId: 'gone'}));
  expect(dialogsSaid()).toEqual([]);
  expect(navigate).toHaveBeenLastCalledWith('UpdateTransactionScreen', {expenseId: 'e2'});
});
