/**
 * The Money tab's Accounts view (Pro; approved A2, round two item 4): one top
 * card with what is in hand and one line for what is due, the Spend and Save
 * sections, and net worth as a foot line. What is owed on a card is not taken
 * off what is in hand: it is owed, and lives on the Debts tab. Real LokiJS
 * database, the clock held on 13 Nov 2026.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {HeldAccounts} from '../../../../../src/features/money/components/HeldAccounts';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {seedRule} from '../../../../harness/recurringSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

const NOW = new Date(2026, 10, 13, 12, 0, 0);
let seed: AccountsSeed;
beforeEach(async () => {
  jest.useFakeTimers({now: NOW, advanceTimers: true});
  seed = await seedAccounts(); // cash 0, bank 5,000, card owing 1,500, fund 9,000
  setEntitlement({state: 'lifetime'});
  setMockTranslations({
    'money.billsBefore': 'Due before {{date}}',
    'money.afterDue': '{{amount}} after',
    'money.plusVaries': 'Varies: {{titles}}',
    'recurring.nextLine': 'Next: {{title}}, {{when}}',
  });
  jest.mocked(navigate).mockClear();
});
afterEach(() => {
  setMockTranslations({});
  setEntitlement();
  jest.useRealTimers();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<HeldAccounts />);
  await settle();
  await settle();
};

it('with nothing coming: what is in hand, the held accounts, net worth, and still a way into Coming up', async () => {
  await show();
  // In hand: the 5,000 in the bank (the top card, and the Spend heading). The 1,500 owed on the card is not taken off.
  expect(screen.getAllByText('₹5,000').length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText('₹3,500')).toBeNull();
  expect(screen.queryByText(/Due before/)).toBeNull();
  expect(screen.queryByText(/after$/)).toBeNull();
  // The word "free" is the budget's alone (round two, item 7).
  expect(screen.queryByText(/free/i)).toBeNull();
  // Held: spend and save. What is owed is the Debts tab's.
  expect(screen.getByText('accounts.classSpend')).toBeTruthy();
  expect(screen.getByText('accounts.classSave')).toBeTruthy();
  expect(screen.queryByText('accounts.classCard')).toBeNull();
  expect(screen.queryByText('Amex')).toBeNull();
  // Net worth: 5,000 + 9,000 − 1,500, one quiet line that opens its sum.
  expect(screen.getByText('₹12,500')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('net-worth-line'));
  expect(navigate).toHaveBeenLastCalledWith('NetWorthScreen');
  // No balance was ever set by hand: the card says the figures rest on the entries.
  expect(screen.getByText('money.neverChecked')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('held-due-line'));
  expect(navigate).toHaveBeenLastCalledWith('RecurringScreen');
});

it('what is due before the next month is one line: the sum, what is next, and what is left after', async () => {
  // Due 20 Nov (after today) and 1 Dec (the next month: not counted).
  await seedRule(seed, {title: 'Gym', amount: 750, startDate: '2026-11-20'}, '2026-11-13');
  await seedRule(seed, {title: 'Rent', amount: 18_000, startDate: '2026-12-01'}, '2026-11-13');
  await seedRule(seed, {title: 'Electricity', amount: null, startDate: '2026-11-25'}, '2026-11-13');
  // A card bill takes money out of hand: the card's debt is not taken off it beforehand.
  await seedRule(
    seed,
    {
      target: 'transfer',
      title: 'Card bill',
      categoryId: '',
      toAccountId: seed.card,
      amount: 1500,
      startDate: '2026-11-22',
    },
    '2026-11-13',
  );
  // Money put away leaves what is in hand.
  await seedRule(
    seed,
    {target: 'transfer', title: 'SIP', categoryId: '', toAccountId: seed.fund, amount: 1000, startDate: '2026-11-28'},
    '2026-11-13',
  );
  await show();
  expect(screen.getByText(/^Due before (1 Dec|Dec 1)$/)).toBeTruthy();
  expect(screen.getByText('₹3,250')).toBeTruthy(); // gym 750 + card bill 1,500 + SIP 1,000
  // 5,000 − 3,250 is what is left after, said with the word "after".
  expect(screen.getByText(/^Next: Gym, .* · ₹1,750 after$/)).toBeTruthy();
  expect(screen.getByText('Varies: Electricity')).toBeTruthy();
});

it('the figure opens the accounts, the button moves money', async () => {
  await show();
  await fireEvent.press(screen.getByTestId('held-in-hand'));
  expect(navigate).toHaveBeenLastCalledWith('AccountsScreen');
  await fireEvent.press(screen.getByTestId('held-move'));
  expect(navigate).toHaveBeenLastCalledWith('TransferScreen', {});
});
