/**
 * The account row on the expense form (3.0, plan P8). With Pro and more than
 * one active account it is there, filled in with the default; without Pro it
 * does not exist. Either way, adding an expense takes exactly the same taps
 * (ZERO_3.0_PRO.md §5), and a free edit never moves an expense off an
 * account it cannot see (law L6). Real LokiJS database, real form.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {fetchCategories} from '../../../../../src/store/slices/categoryDataSlice';
import {ExpenseEntry} from '../../../../../src/features/spending/components/ExpenseEntry';
import {createAccount} from '../../../../../src/data/services/accountService';
import {getExpenseAccountId} from '../../../../../src/data/services/expenseService';
import {defaultAccountId} from '../../../../../src/data/database/defaultAccount';
import {resetEntitlement, setEntitlement} from '../../../../harness/mocks/entitlement';
import * as services from '../../../../harness/services';
import {renderInApp} from '../../../../harness/render';
import {periodFor, periodKeyOf} from '../../../../../src/domain/period';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
// An edit lists the expense's refunds, read on focus; rendered alone, mounted is focused.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);

let userId = '';
let hdfc = '';
let snacks = '';

beforeEach(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  snacks = await services.createCategory('Snacks', userId, 'utensils', '#111111', 'expense');
  hdfc = await createAccount(userId, {
    name: 'HDFC',
    type: 'bank',
    openingBalance: 0,
    openingDate: null,
    icon: 'landmark',
    color: '#224466',
  });
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
  await store.dispatch(fetchCategories());
});
afterEach(async () => {
  await act(async () => resetEntitlement());
  jest.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

/** Adds "Lunch, 250, Snacks" the way a person does, counting the taps. */
const addLunch = async (): Promise<number> => {
  let taps = 0;
  const tap = async (element: Parameters<typeof fireEvent.press>[0]) => {
    taps++;
    await fireEvent.press(element);
  };
  await fireEvent.changeText(screen.getByPlaceholderText('transaction.titlePlaceholder'), 'Lunch');
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '250');
  await tap(screen.getByText('Snacks'));
  await tap(screen.getByText('common.add'));
  await settle();
  return taps;
};

const onlyExpenseAccount = async (): Promise<string | null> => {
  const [expense] = await services.getAllExpensesByMonth(userId, periodFor(periodKeyOf(new Date())));
  return expense ? getExpenseAccountId(expense.id) : null;
};

it('without Pro there is no account row, and the expense lands on the default account', async () => {
  await renderInApp(<ExpenseEntry />);
  await settle();
  expect(screen.queryByText('accounts.rowLabel')).toBeNull();
  expect(await addLunch()).toBe(2);
  expect(await onlyExpenseAccount()).toBe(defaultAccountId(userId));
});

it('with Pro the row is there, filled in, and adding takes the same taps', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  await renderInApp(<ExpenseEntry />);
  await settle();
  expect(screen.getByText('accounts.rowLabel')).toBeTruthy();
  expect(screen.getByText('accounts.cash')).toBeTruthy(); // the default, translated
  expect(await addLunch()).toBe(2);
  expect(await onlyExpenseAccount()).toBe(defaultAccountId(userId));
});

it('with Pro, picking another account is a deliberate tap and the expense goes there', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_id, options) => {
    (options as {payload: {onSelect: (id: string) => void}}).payload.onSelect(hdfc); // the picker's own payload
    return undefined;
  });
  await renderInApp(<ExpenseEntry />);
  await settle();
  await fireEvent.press(screen.getByText('accounts.rowLabel'));
  expect(screen.getByText('HDFC')).toBeTruthy();
  await addLunch();
  expect(await onlyExpenseAccount()).toBe(hdfc);
});

it('with Pro and one active account there is no row: nothing to choose', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  await services.createCategory('Snacks', userId, 'utensils', '#111111', 'expense');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
  await act(async () => setEntitlement({state: 'lifetime'}));
  await renderInApp(<ExpenseEntry />);
  await settle();
  expect(screen.queryByText('accounts.rowLabel')).toBeNull();
});

it('a free edit keeps the account it cannot see (L6)', async () => {
  const id = await services.createExpense(userId, 'Shoes', 3000, '', snacks, '2026-11-03T18:00:00', {accountId: hdfc});
  const editing = await services.getExpenseById(id);
  await renderInApp(<ExpenseEntry editing={editing!} />);
  await settle();
  expect(screen.queryByText('accounts.rowLabel')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '2800');
  await fireEvent.press(screen.getByText('common.update'));
  await settle();
  expect((await services.getExpenseById(id))?.amount).toBe(2800);
  expect(await getExpenseAccountId(id)).toBe(hdfc);
});

it('reconcile’s draft fills in the day and the account, and the expense goes there', async () => {
  await act(async () => setEntitlement({state: 'lifetime'}));
  await renderInApp(
    <ExpenseEntry draft={{title: '', amount: '350', categoryId: '', date: '2026-11-04T12:00:00', accountId: hdfc}} />,
  );
  await settle();
  expect(screen.getByText('HDFC')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('transaction.titlePlaceholder'), 'ATM fee');
  await fireEvent.press(screen.getByText('Snacks'));
  await fireEvent.press(screen.getByText('common.add'));
  await settle();
  const [saved] = await services.getAllExpensesByMonth(userId, periodFor('2026-11'));
  expect(saved).toMatchObject({title: 'ATM fee', amount: 350, date: '2026-11-04T12:00:00'});
  expect(await getExpenseAccountId(saved!.id)).toBe(hdfc);
});
