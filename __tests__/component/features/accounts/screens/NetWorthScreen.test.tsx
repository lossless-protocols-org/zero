/**
 * Net worth (3.0 Pro): one number, four lines, and this month's change in
 * words; a line that did not move this month is left out. No chart.
 * Real LokiJS database.
 */
import React from 'react';
import {act, screen} from '@testing-library/react-native';
import {NetWorthScreen} from '../../../../../src/features/accounts/screens/NetWorthScreen';
import {acceptCheckpoint} from '../../../../../src/data/services/checkpointService';
import {createDebt} from '../../../../../src/data/services/debtService';
import {formatDate} from '../../../../../src/domain/dates';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import * as netWorth from '../../../../../src/data/services/netWorthService';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import * as services from '../../../../harness/services';
import {renderInApp} from '../../../../harness/render';
import type {IsoDay} from '../../../../../src/domain/types';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

let seed: AccountsSeed;
const today = formatDate(undefined) as IsoDay; // formatDate's default shape is YYYY-MM-DD
beforeEach(async () => {
  seed = await seedAccounts();
  setMockTranslations({});
});
afterEach(() => {
  setMockTranslations({});
  jest.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

it('shows the total, what is had and what is owed with their subtotals, and the month as a sum', async () => {
  await services.createExpense(seed.userId, 'Lunch', 250, '', seed.snacks, `${today}T08:00:00`);
  await acceptCheckpoint(seed.userId, {accountId: seed.fund, balance: 9400, date: today, note: ''});
  const debtor = await services.createDebtor('Rohit', seed.userId, 'user', 'Person', '#222222');
  await createDebt(seed.userId, 200, '', debtor, today, 'Lend');
  await renderInApp(<NetWorthScreen />);
  await settle();
  // Cash −250, HDFC 5,000, Amex −1,500 owed, fund 9,400, Rohit owes 200: 12,850.
  expect(screen.getByText(/12,850/)).toBeTruthy();
  for (const line of [
    'accounts.lineCashAndBank',
    'accounts.lineInvestments',
    'accounts.lineOwedToYou',
    'accounts.lineYouOwe',
  ]) {
    expect(screen.getByText(line)).toBeTruthy();
  }
  // The two groups carry their own subtotals: have 14,350 (4,750 + 9,400 + 200), owe 1,500.
  expect(screen.getByText('accounts.whatYouHave')).toBeTruthy();
  expect(screen.getByText('₹14,350')).toBeTruthy();
  expect(screen.getByText('accounts.whatYouOwe')).toBeTruthy();
  // The month as lines with their figures: kept −250, investments +400.
  expect(screen.getByLabelText(/^accounts\.sinceKept, −.*250$/)).toBeTruthy();
  expect(screen.getByLabelText(/^accounts\.sinceInvestments, \+.*400$/)).toBeTruthy();
  // No adjustment this month: the line is left out.
  expect(screen.queryByText('accounts.sinceUnexplained')).toBeNull();
  expect(screen.getByText('accounts.sinceChange')).toBeTruthy();
});

it('when the month does not add up, the rest is shown, not hidden', async () => {
  jest.spyOn(netWorth, 'articulate').mockResolvedValue({
    netWorthChange: 100,
    kept: 90,
    revaluations: 0,
    adjustments: 0,
    openings: 0,
    debtsOutsideAccounts: 0,
    holds: false,
  });
  await renderInApp(<NetWorthScreen />);
  await settle();
  expect(screen.getByLabelText(/^accounts\.sinceResidual, \+.*10$/)).toBeTruthy();
});
