/**
 * The account sections the Money and Debts tabs share (approved model A2/A3):
 * one section per class under its one word with its subtotal; two or more
 * accounts of one kind fold into one row with their subtotal, and a tap opens
 * them. Real LokiJS database.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {AccountSections} from '../../../../src/ui/molecules/AccountSections';
import {createAccount} from '../../../../src/data/services/accountService';
import {getNetWorth, type AccountBalance} from '../../../../src/data/services/netWorthService';
import {todayIsoDay} from '../../../../src/domain/dates';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../harness/accountsSeed';
import {renderInApp} from '../../../harness/render';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

let seed: AccountsSeed;
let accounts: AccountBalance[];
const onOpen = jest.fn();
const onPayBill = jest.fn();

beforeEach(async () => {
  seed = await seedAccounts(); // cash 0, bank 5,000 (HDFC), card owing 1,500 (Amex), fund 9,000
  const add = (name: string, type: 'bank' | 'card' | 'loan', openingBalance: number, kind = '') =>
    createAccount(seed.userId, {name, type, openingBalance, openingDate: null, icon: 'landmark', color: '', kind});
  await add('SBI', 'bank', 2000);
  await add('Coral', 'card', -700);
  await add('Bike loan', 'loan', -20_000, 'Bike');
  accounts = (await getNetWorth(seed.userId, todayIsoDay())).accounts;
  setMockTranslations({
    'accounts.youOweAmount': 'You owe {{amount}}',
    'accounts.rowA11y': '{{name}}, {{amount}}',
    'accounts.typeBank': 'Bank',
    'accounts.typeCash': 'Cash',
    'accounts.kindCredit': 'Credit',
    'accounts.kindCount': '{{count}} accounts',
  });
  onOpen.mockClear();
  onPayBill.mockClear();
});
afterEach(() => setMockTranslations({}));

it('lists only the classes asked for, each under its word with its subtotal', async () => {
  await renderInApp(<AccountSections classes={['spend', 'save']} accounts={accounts} onOpen={onOpen} />);
  expect(screen.getByText('accounts.classSpend')).toBeTruthy();
  expect(screen.getByText('accounts.classSave')).toBeTruthy();
  expect(screen.queryByText('accounts.classCard')).toBeNull();
  expect(screen.queryByText('accounts.classLoan')).toBeNull();
  // Spend: cash 0 + HDFC 5,000 + SBI 2,000. The two banks fold into one row with the same figure.
  expect(screen.getAllByText('₹7,000')).toHaveLength(2);
  expect(screen.getAllByText('₹9,000')).toHaveLength(2); // Save's subtotal and the fund's own row
});

it('two accounts of one kind fold into one row; a tap opens them and another closes them', async () => {
  await renderInApp(<AccountSections classes={['spend']} accounts={accounts} onOpen={onOpen} />);
  expect(screen.getByText('Bank')).toBeTruthy();
  expect(screen.getByText('2 accounts')).toBeTruthy();
  expect(screen.queryByText('HDFC')).toBeNull();
  // The default account is the only one of its kind: it is listed as it is.
  expect(screen.getByText('accounts.cash')).toBeTruthy();
  await fireEvent.press(screen.getByText('Bank'));
  expect(screen.getByText('HDFC')).toBeTruthy();
  expect(screen.getByText('SBI')).toBeTruthy();
  await fireEvent.press(screen.getByText('HDFC'));
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({accountId: seed.bank}));
  await fireEvent.press(screen.getByText('Bank'));
  expect(screen.queryByText('HDFC')).toBeNull();
});

it('what is owed reads as a positive figure; a card offers its bill, a loan does not', async () => {
  await renderInApp(
    <AccountSections classes={['card', 'loan']} accounts={accounts} onOpen={onOpen} onPayBill={onPayBill} />,
  );
  // Cards: 1,500 + 700, folded under "Credit". The loan has its own word, so it stands alone.
  expect(screen.getAllByText('₹2,200')).toHaveLength(2);
  expect(screen.getAllByText('₹20,000')).toHaveLength(2);
  expect(screen.getByText('Bike loan')).toBeTruthy();
  expect(screen.queryByText('accounts.payBill')).toBeNull();
  await fireEvent.press(screen.getByText('Credit'));
  const bills = screen.getAllByText('accounts.payBill');
  expect(bills).toHaveLength(2);
  await fireEvent.press(bills[0]!); // two cards were just asserted
  expect(onPayBill).toHaveBeenCalledWith(expect.objectContaining({accountId: seed.card}));
});

it('a class with no account has no section, and archived accounts are left out', async () => {
  const active = accounts.map(account => (account.name === 'Bike loan' ? {...account, active: false} : account));
  await renderInApp(<AccountSections classes={['loan']} accounts={active} onOpen={onOpen} />);
  expect(screen.queryByText('accounts.classLoan')).toBeNull();
});
