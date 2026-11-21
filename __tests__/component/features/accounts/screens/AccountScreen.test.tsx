/**
 * One account (3.0 Pro): its balance and anchor, one month of every row on it
 * from every table, and the actions: reconcile, transfer, make default,
 * archive. The default cannot be archived; removing a balance asks first.
 * Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {AccountScreen} from '../../../../../src/features/accounts/screens/AccountScreen';
import {acceptCheckpoint} from '../../../../../src/data/services/checkpointService';
import {createTransfer} from '../../../../../src/data/services/transferService';
import {createRefund} from '../../../../../src/data/services/refundService';
import {getAccountById} from '../../../../../src/data/services/accountService';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {formatDate} from '../../../../../src/domain/dates';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import * as services from '../../../../harness/services';
import {renderInApp} from '../../../../harness/render';
import {createCheckpoint} from '../../../../../src/data/services/checkpointService';
import type {IsoDay} from '../../../../../src/domain/types';

let mockAccountId = '';
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
  useRoute: () => ({params: {accountId: mockAccountId}}),
}));

let seed: AccountsSeed;
const today = formatDate(undefined) as IsoDay; // formatDate's default shape is YYYY-MM-DD
beforeEach(async () => {
  seed = await seedAccounts();
  resetDialogs();
  jest.mocked(navigate).mockClear();
  setMockTranslations({
    'accounts.transferIn': 'From {{name}}',
    'accounts.transferOut': 'To {{name}}',
    'accounts.refundLine': 'Refund: {{title}}',
  });
});
afterEach(() => setMockTranslations({}));

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async (accountId: string) => {
  mockAccountId = accountId;
  await renderInApp(<AccountScreen />);
  await settle();
};

it('lists the month on the account from every table, and opens each where it is edited', async () => {
  const shoes = await services.createExpense(seed.userId, 'Shoes', 3000, '', seed.snacks, `${today}T08:00:00`, {
    accountId: seed.bank,
  });
  await createRefund(shoes, {amount: 500, date: `${today}T09:00:00`, note: ''});
  const sip = await createTransfer(seed.userId, {
    fromAccountId: seed.bank,
    toAccountId: seed.fund,
    amount: 1000,
    date: today,
    note: '',
  });
  await show(seed.bank);
  expect(screen.getByText('Shoes')).toBeTruthy();
  expect(screen.getByText('Refund: Shoes')).toBeTruthy();
  expect(screen.getByText('To Index fund')).toBeTruthy();
  // 5,000 − 3,000 + 500 − 1,000
  expect(screen.getByText(/1,500/)).toBeTruthy();
  expect(screen.getByText('accounts.fromOpening')).toBeTruthy();
  await fireEvent.press(screen.getByText('Shoes'));
  expect(navigate).toHaveBeenLastCalledWith('UpdateTransactionScreen', {expenseId: shoes});
  await fireEvent.press(screen.getByText('To Index fund'));
  expect(navigate).toHaveBeenLastCalledWith('TransferScreen', {transferId: sip});
  await fireEvent.press(screen.getByText('accounts.reconcile'));
  expect(navigate).toHaveBeenLastCalledWith('ReconcileScreen', {accountId: seed.bank});
});

it('a balance set by reconciling anchors the account, and removing it asks first', async () => {
  await acceptCheckpoint(seed.userId, {accountId: seed.bank, balance: 4200, date: today, note: ''});
  await show(seed.bank);
  expect(screen.getByText('accounts.reconciledOn')).toBeTruthy();
  answerNextDialog(false);
  await fireEvent.press(screen.getByText('accounts.checkpointLine'));
  await settle();
  expect(dialogsSaid()).toEqual(['warning: accounts.removeCheckpointConfirm']);
  expect(screen.getByText('accounts.reconciledOn')).toBeTruthy();
});

it('makes an account the default, and archives one after asking', async () => {
  await show(seed.bank);
  await fireEvent.press(screen.getByText('accounts.makeDefault'));
  await settle();
  expect((await getAccountById(seed.bank))?.isDefault).toBe(true);
  expect((await getAccountById(seed.cash))?.isDefault).toBe(false);
  await show(seed.card);
  await fireEvent.press(screen.getByText('accounts.archive'));
  await settle();
  expect((await getAccountById(seed.card))?.active).toBe(false);
  expect(dialogsSaid()).toContain('warning: accounts.archiveConfirm');
});

it('the default account cannot be archived: it says what to do instead', async () => {
  await show(seed.cash);
  await fireEvent.press(screen.getByText('accounts.archive'));
  await settle();
  expect(dialogsSaid()).toEqual(['info: accounts.defaultCannotBeArchived']);
  expect((await getAccountById(seed.cash))?.active).toBe(true);
});

it('an account that no longer exists says so', async () => {
  await show('gone');
  expect(screen.getByText('common.recordMissing')).toBeTruthy();
});

// UX revamp v2: what the screen leads with depends on what the account is.
it('a card says what is owed, offers to pay its bill, and says paying is not spending again', async () => {
  await show(seed.card);
  expect(screen.getByText('accounts.lineYouOwe')).toBeTruthy();
  expect(screen.getByText('₹1,500')).toBeTruthy();
  expect(screen.getByText('accounts.cardBillNote')).toBeTruthy();
  await fireEvent.press(screen.getByText('accounts.payBill'));
  expect(navigate).toHaveBeenLastCalledWith('TransferScreen', {toAccountId: seed.card, amount: 1500});
  await fireEvent.press(screen.getByText('accounts.checkOwed'));
  expect(navigate).toHaveBeenLastCalledWith('ReconcileScreen', {accountId: seed.card});
});

it('an investment says what it is worth and leads with updating that', async () => {
  await show(seed.fund);
  expect(screen.getByText('accounts.worth')).toBeTruthy();
  expect(screen.queryByText('accounts.cardBillNote')).toBeNull();
  await fireEvent.press(screen.getByText('accounts.updateValue'));
  expect(navigate).toHaveBeenLastCalledWith('ReconcileScreen', {accountId: seed.fund});
});

it('a balance checked long ago is flagged; a recent one is only dated', async () => {
  await createCheckpoint(seed.userId, {
    accountId: seed.bank,
    balance: 5000,
    date: '2020-01-01' as IsoDay, // written as YYYY-MM-DD
    gap: 0,
    kind: 'adjustment',
    note: '',
  });
  await show(seed.bank);
  expect(screen.getByText('accounts.notCheckedSince')).toBeTruthy();
  expect(screen.queryByText('accounts.reconciledOn')).toBeNull();
});

it('money moved to another account is marked as moved, not spent', async () => {
  await createTransfer(seed.userId, {
    fromAccountId: seed.bank,
    toAccountId: seed.card,
    amount: 500,
    date: today,
    note: '',
  });
  await show(seed.bank);
  expect(screen.getByText('To Amex')).toBeTruthy();
  expect(screen.getByText('accounts.movedShort')).toBeTruthy();
});
