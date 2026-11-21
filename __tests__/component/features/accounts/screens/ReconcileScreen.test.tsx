/**
 * Reconciling (3.0 Pro): type the real balance, see what the entries give and
 * the gap in words, save. On an investment the gap is its value change (R15);
 * on any other account it is what the entries do not explain. The entries
 * are never changed. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {database} from '../../../../../src/data/database/database';
import {ReconcileScreen} from '../../../../../src/features/accounts/screens/ReconcileScreen';
import {goBack, navigate} from '../../../../../src/platform/navigationUtils';
import {takeIncomeDraft, takeQuickAddDraft} from '../../../../../src/ui/quickAddDraft';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

let mockAccountId = '';
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
  useRoute: () => ({params: {accountId: mockAccountId}}),
}));

let seed: AccountsSeed;
beforeEach(async () => {
  seed = await seedAccounts();
  jest.mocked(goBack).mockClear();
  setMockTranslations({
    'accounts.worksOut': 'Your entries give {{amount}}',
    'accounts.gapLess': '{{amount}} less',
    'accounts.valueUp': 'gained {{amount}}',
  });
});
afterEach(() => setMockTranslations({}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async (accountId: string) => {
  mockAccountId = accountId;
  await renderInApp(<ReconcileScreen />);
  await settle();
};
const checkpoints = async () =>
  (await database.get('checkpoints').query().unsafeFetchRaw()) as Array<Record<string, unknown>>;

it('a bank balance below what the entries give is an unexplained gap, recorded as an adjustment', async () => {
  await show(seed.bank);
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '4650');
  await settle();
  // Two figures face to face: what zero says, and what was typed.
  expect(screen.getByText('accounts.zeroSays')).toBeTruthy();
  expect(screen.getByText('₹5,000')).toBeTruthy();
  expect(screen.getByText('accounts.gapLessWhy')).toBeTruthy();
  expect(screen.getByText(/^.*350 less$/)).toBeTruthy();
  await fireEvent.press(screen.getByText('accounts.accept'));
  await settle();
  expect(await checkpoints()).toEqual([
    expect.objectContaining({account_id: seed.bank, balance: 4650, gap: -350, kind: 'adjustment'}),
  ]);
  expect(goBack).toHaveBeenCalled();
});

it('an investment worth more is a value change, recorded as a revaluation', async () => {
  await show(seed.fund);
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '9400');
  await settle();
  expect(screen.getByText(/^gained .*400$/)).toBeTruthy();
  // Growth is said to be growth, not money in; the screen is named for the act.
  expect(screen.getByText('accounts.valueWhy')).toBeTruthy();
  expect(screen.getByText('accounts.updateValue')).toBeTruthy();
  await fireEvent.press(screen.getByText('accounts.acceptValue'));
  await settle();
  expect(await checkpoints()).toEqual([expect.objectContaining({gap: 400, kind: 'revaluation'})]);
});

it('a card takes what is owed as the statement prints it: no minus sign to type', async () => {
  await show(seed.card);
  expect(screen.getByText('accounts.checkOwed')).toBeTruthy();
  expect(screen.getByText('accounts.checkOwes')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '1500');
  await settle();
  expect(screen.getByText('accounts.gapNone')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '1800');
  await settle();
  await fireEvent.press(screen.getByText('accounts.accept'));
  await settle();
  // Stored as the card's balance: below zero, 300 further than the entries give.
  expect(await checkpoints()).toEqual([expect.objectContaining({account_id: seed.card, balance: -1800, gap: -300})]);
});

it('nothing typed, nothing to save', async () => {
  await show(seed.bank);
  expect(screen.getByRole('button', {name: 'accounts.accept'})).toBeDisabled();
});

describe('"Record what\u2019s missing"', () => {
  it('a bank account short of its entries opens Add expense, filled in with the gap, the day and the account', async () => {
    await show(seed.bank);
    await fireEvent.changeText(screen.getByPlaceholderText('0'), '4650');
    await settle();
    await fireEvent.press(screen.getByText('accounts.recordMissingExpense'));
    expect(navigate).toHaveBeenLastCalledWith('AddTransactionsScreen');
    expect(takeQuickAddDraft()).toMatchObject({amount: '350', accountId: seed.bank, categoryId: ''});
  });

  it('more in the account than the entries say opens Add money in instead', async () => {
    await show(seed.bank);
    await fireEvent.changeText(screen.getByPlaceholderText('0'), '5200');
    await settle();
    await fireEvent.press(screen.getByText('accounts.recordMissingIncome'));
    expect(navigate).toHaveBeenLastCalledWith('AddIncomeScreen', {});
    expect(takeIncomeDraft()).toMatchObject({amount: '200', accountId: seed.bank});
  });

  it('is not offered on an investment (its gap is a value change) or when nothing is missing', async () => {
    await show(seed.fund);
    await fireEvent.changeText(screen.getByPlaceholderText('0'), '9400');
    await settle();
    expect(screen.queryByText('accounts.recordMissingIncome')).toBeNull();
    await show(seed.bank);
    await fireEvent.changeText(screen.getByPlaceholderText('0'), '5000');
    await settle();
    expect(screen.queryByText(/accounts.recordMissing/)).toBeNull();
  });
});
