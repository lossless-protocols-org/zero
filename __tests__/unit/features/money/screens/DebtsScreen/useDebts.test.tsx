/**
 * The Debts tab's people and tallies: every debtor split into people and the
 * card and loan tallies, and what they net to. Read on focus and after a
 * write while focused. Real store and LokiJS database.
 */
import {act, waitFor} from '@testing-library/react-native';
import {store} from '../../../../../../src/store/store';
import {resetSession} from '../../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../../src/store/slices/userIdSlice';
import {createDebt} from '../../../../../../src/data/services/debtService';
import {useDebts} from '../../../../../../src/features/money/screens/DebtsScreen/useDebts';
import * as services from '../../../../../harness/services';
import {renderHookInApp} from '../../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../../harness/mocks/focusEffect'),
}));

let userId = '';
let riya = '';

beforeAll(async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  riya = await services.createDebtor('Riya', userId, 'user', 'Person', '#222222');
  const card = await services.createDebtor('Old card', userId, 'credit-card', 'Credit Card', '#111111');
  await createDebt(userId, 700, 'lent', riya, '2026-11-08T10:00:00', 'Lend');
  await createDebt(userId, 2000, 'spent', card, '2026-11-09T10:00:00', 'Borrow');
  await store.dispatch(fetchUserData());
});

it('splits debtors into people and tallies with what stands between you, nets them, and follows a write', async () => {
  const view = await renderHookInApp(() => useDebts());
  await waitFor(() => expect(view.result.current.people).toHaveLength(1));
  // Riya borrowed 700: she owes you, so her net is below zero. 2,000 was spent on the tally: you owe it.
  expect(view.result.current.people.map(row => [row.title, row.net])).toEqual([['Riya', -700]]);
  expect(view.result.current.tallies.map(row => [row.title, row.net])).toEqual([['Old card', 2000]]);
  expect(view.result.current.peopleNet).toBe(-700);
  expect(view.result.current.talliesNet).toBe(2000);
  // 2,000 borrowed on the tally less the 700 Riya owes.
  expect(view.result.current.totalDebts).toBe(1300);
  expect(view.result.current.empty).toBe(false);

  await act(() => createDebt(userId, 300, 'more', riya, '2026-11-10T10:00:00', 'Lend'));
  await waitFor(() => expect(view.result.current.totalDebts).toBe(1000));
  expect(view.result.current.peopleNet).toBe(-1000);
  await view.unmount();
});
