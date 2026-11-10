/**
 * The quick-add sheet as the user meets it (2.8): amount first, a category
 * chip, an optional title, Save; Close or a tap outside leave without saving;
 * before onboarding it only offers to open zero. Real store, services and
 * LokiJS database; the host (window or screen) is a spy. Before this suite
 * the sheet had 4 of 24 lines covered (audit 2026-11-08 §7.6).
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AccessibilityInfo} from 'react-native';
import {Provider} from 'react-redux';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCurrency} from '../../../../../src/store/slices/currencyDataSlice';
import {QuickAddSheet} from '../../../../../src/features/widgets/quickAdd/QuickAddSheet';
import type {QuickAddHost} from '../../../../../src/features/widgets/quickAdd/host';
import * as services from '../../../../harness/services';
import {renderWithTheme} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

const NOW = new Date(2026, 10, 15, 12, 0, 0);
let userId = '';
let fuel = '';

beforeEach(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await services.deleteAllData();
  store.dispatch(resetSession());
  userId = await services.createUser('Ravi', '');
  await services.createCurrency('INR', '₹', 'Indian Rupee', userId);
  await services.createCategory('Groceries', userId, 'pizza', '#111111', 'expense');
  fuel = await services.createCategory('Petrol', userId, 'car', '#222222', 'expense');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCurrency());
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const open = async (ready = true) => {
  const host: QuickAddHost = {close: jest.fn(), openFull: jest.fn(), dimLeaving: jest.fn(), drawsScrim: true};
  await renderWithTheme(
    <Provider store={store}>
      <QuickAddSheet kind="expense" categoryId="" ready={ready} host={host} />
    </Provider>,
  );
  await act(() => Promise.resolve()); // the categories load
  return host;
};

/** The exit animation runs its course. */
const finishLeaving = () => act(() => jest.advanceTimersByTime(500));

it('saves what was typed in the chosen category, then closes', async () => {
  const host = await open();
  const save = screen.getByRole('button', {name: 'quickAdd.save'});
  expect(save).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('quickAdd.amount'), '45');
  await fireEvent.press(screen.getByText('Petrol'));
  await fireEvent.changeText(screen.getByLabelText('quickAdd.whatFor'), 'Top up');
  expect(save).toBeEnabled();
  await fireEvent.press(save);
  await finishLeaving();
  const saved = await services.getAllExpensesByMonth(userId, '2026-11');
  expect(saved.map(e => [e.title, e.amount, e.category?.id])).toEqual([['Top up', 45, fuel]]);
  expect(host.close).toHaveBeenCalledTimes(1);
});

it('Close leaves without saving', async () => {
  const host = await open();
  await fireEvent.changeText(screen.getByLabelText('quickAdd.amount'), '45');
  const [scrim, closeButton] = screen.getAllByRole('button', {name: 'quickAdd.close'});
  expect(scrim).toBeDefined();
  if (!closeButton) {
    throw new Error('no Close button');
  }
  await fireEvent.press(closeButton);
  await finishLeaving();
  expect(host.close).toHaveBeenCalledTimes(1);
  expect(await services.getAllExpensesByMonth(userId, '2026-11')).toEqual([]);
});

it('before onboarding, only offers to open zero', async () => {
  const host = await open(false);
  expect(screen.getByText('quickAdd.notReady')).toBeOnTheScreen();
  expect(screen.queryByLabelText('quickAdd.amount')).toBeNull();
  await fireEvent.press(screen.getByRole('button', {name: 'quickAdd.openZero'}));
  await finishLeaving();
  expect(host.openFull).toHaveBeenCalledWith('expense');
});
