/**
 * The Recurring screen (3.0 Pro, P9): rules by kind with how often and when
 * next; a rule behind offers "add them" or "start from today", each a
 * deliberate tap; an occurrence that varies waits to be confirmed or skipped.
 * Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {Q} from '@nozbe/watermelondb';
import {database} from '../../../../../src/data/database/database';
import {todayIsoDay} from '../../../../../src/domain/dates';
import {RecurringScreen} from '../../../../../src/features/recurring/screens/RecurringScreen';
import {getRuleById} from '../../../../../src/data/services/recurringService';
import {setRecurringState} from '../../../../../src/pro/recurringState';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {seedRule} from '../../../../harness/recurringSeed';
import {renderInApp} from '../../../../harness/render';
import type {Due} from '../../../../../src/domain/commitments';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

// What is due is read by useCommitments (its own suite); here the screen is given it.
let mockDue: Due[] = [];
jest.mock('../../../../../src/ui/hooks/useCommitments', () => ({
  useCommitments: () => {
    const {stillToPay, billsInBudget} = jest.requireActual('../../../../../src/domain/commitments');
    return {
      due: mockDue,
      still: stillToPay(mockDue),
      bills: billsInBudget(mockDue),
      lastDay: '2026-11-30',
      nextStart: '2026-12-01',
    };
  },
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  resetDialogs();
  jest.mocked(navigate).mockClear();
  setRecurringState({behind: [], asks: []});
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<RecurringScreen />);
  await settle();
};

it('the rules fold away at the bottom; opened, they are listed under their kind and open to edit', async () => {
  // Far in the future, so nothing of theirs is "coming up" and each title appears once.
  const rent = await seedRule(seed, {startDate: '2099-01-01'});
  await seedRule(seed, {
    target: 'transfer',
    title: 'SIP',
    categoryId: '',
    toAccountId: seed.fund,
    amount: 5000,
    startDate: '2099-01-01',
  });
  await show();
  expect(screen.queryByText('recurring.sectionExpenses')).toBeNull();
  await fireEvent.press(screen.getByText('recurring.allRules'));
  expect(screen.getByText('recurring.sectionExpenses')).toBeTruthy();
  expect(screen.getByText('recurring.sectionTransfers')).toBeTruthy();
  expect(screen.queryByText('recurring.sectionIncome')).toBeNull();
  await fireEvent.press(screen.getByText('Rent'));
  expect(navigate).toHaveBeenLastCalledWith('RuleFormScreen', {ruleId: rent});
});

it('with nothing yet, says what it is for', async () => {
  await show();
  expect(screen.getByText('recurring.emptyTitle')).toBeTruthy();
});

it('a rule behind: "add them" makes each missed entry; "start from today" skips them', async () => {
  const rent = await seedRule(seed, {startDate: '2026-08-01'}, '2026-08-01');
  setRecurringState({behind: [{ruleId: rent, title: 'Rent', missed: 3}], asks: []});
  await show();
  await fireEvent.press(screen.getByText('recurring.missedAdd'));
  await settle();
  expect(await database.get('expenses').query().fetchCount()).toBeGreaterThanOrEqual(3);
  const other = await seedRule(seed, {title: 'Gym', startDate: '2026-08-02'}, '2026-08-02');
  await act(async () => setRecurringState({behind: [{ruleId: other, title: 'Gym', missed: 3}], asks: []}));
  await settle();
  await fireEvent.press(screen.getByText('recurring.missedSkip'));
  await settle();
  // Moved past every missed occurrence, to today or later; nothing was made for them.
  expect(((await getRuleById(other))?.nextRun ?? '') >= todayIsoDay()).toBe(true);
  expect(await database.get('expenses').query(Q.where('title', 'Gym')).fetchCount()).toBe(0);
});

it('an occurrence that varies is confirmed on its own screen, or skipped after asking', async () => {
  const bill = await seedRule(seed, {title: 'Electricity', amount: null});
  setRecurringState({
    behind: [],
    asks: [{ruleId: bill, index: 0, day: '2026-11-01', target: 'expense', title: 'Electricity'}],
  });
  await show();
  await fireEvent.press(screen.getByText('recurring.confirm'));
  expect(navigate).toHaveBeenLastCalledWith('ConfirmRecurringScreen', {ruleId: bill, index: 0});
  await fireEvent.press(screen.getByText('recurring.skip'));
  await settle();
  expect(dialogsSaid()).toEqual(['warning: recurring.skipConfirm']);
  expect((await getRuleById(bill))?.nextIndex).toBe(1);
});

describe('what is still to come this month', () => {
  afterEach(() => {
    mockDue = [];
    setMockTranslations({});
  });

  it('opens with the sum still to pay, and folds a rule that comes several times into one line', async () => {
    setMockTranslations({'recurring.moreTimes': '{{when}}, {{count}} more'});
    const gym = await seedRule(seed, {title: 'Gym', amount: 750, startDate: '2099-01-01'});
    const milk = await seedRule(seed, {title: 'Milk', amount: 420, cadence: 'weekly', startDate: '2099-01-01'});
    const due = (ruleId: string, title: string, day: string, amount: number, index = 0): Due => ({
      ruleId,
      index,
      day,
      title,
      target: 'expense',
      amount,
      leaves: true,
    });
    mockDue = [
      due(milk, 'Milk', '2026-11-16', 420),
      due(gym, 'Gym', '2026-11-20', 750),
      due(milk, 'Milk', '2026-11-23', 420, 1),
      due(milk, 'Milk', '2026-11-30', 420, 2),
    ];
    await show();
    expect(screen.getByText('recurring.stillToPay')).toBeTruthy();
    expect(screen.getByText('₹2,010')).toBeTruthy();
    // Milk three times is one line with its sum; the gym another.
    expect(screen.getByText('₹1,260')).toBeTruthy();
    expect(screen.getByText(/, 2 more$/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Gym'));
    expect(navigate).toHaveBeenLastCalledWith('RuleFormScreen', {ruleId: gym});
  });
});
