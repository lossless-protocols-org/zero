/**
 * Moving money (3.0 Pro; UX revamp v2: amount first, both accounts in one
 * card with their balances now and after, a swap, and paying a card's bill
 * pre-filled). From starts on the account it was opened from (else
 * the default), To on the next active one; the two must differ; an edit
 * sends only what changed and can delete. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {database} from '../../../../../src/data/database/database';
import {TransferScreen} from '../../../../../src/features/accounts/screens/TransferScreen';
import {createTransfer, getTransferById} from '../../../../../src/data/services/transferService';
import {goBack} from '../../../../../src/platform/navigationUtils';
import {formatDate} from '../../../../../src/domain/dates';
import {dialogsSaid, resetDialogs} from '../../../../harness/mocks/dialogs';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {seedAccounts, type AccountsSeed} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';
import type {IsoDay} from '../../../../../src/domain/types';

let mockParams: {transferId?: string; fromAccountId?: string; toAccountId?: string; amount?: number} | undefined;
jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/ui/context/DialogContext', () =>
  require('../../../../harness/mocks/dialogs').dialogContextMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
  useRoute: () => ({params: mockParams}),
}));

let seed: AccountsSeed;
const today = formatDate(undefined) as IsoDay; // formatDate's default shape is YYYY-MM-DD
beforeEach(async () => {
  seed = await seedAccounts();
  resetDialogs();
  jest.mocked(goBack).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async (params?: typeof mockParams) => {
  mockParams = params;
  await renderInApp(<TransferScreen />);
  await settle();
};
const transfers = async () =>
  (await database.get('transfers').query().unsafeFetchRaw()) as Array<Record<string, unknown>>;

it('moves money from the account it was opened on to another', async () => {
  await show({fromAccountId: seed.bank});
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '750');
  await fireEvent.press(screen.getByRole('button', {name: /accounts\.(transfer|moveAmount)/}));
  await settle();
  const [saved] = await transfers();
  expect(saved).toMatchObject({from_account_id: seed.bank, amount: 750, date: today});
  expect(saved?.['to_account_id']).not.toBe(seed.bank);
  expect(goBack).toHaveBeenCalled();
});

it('picking the same account on both sides is refused before saving', async () => {
  jest.spyOn(SheetManager, 'show').mockImplementation(async (_id, options) => {
    (options as {payload: {onSelect: (id: string) => void}}).payload.onSelect(seed.cash); // the picker's own payload
    return undefined;
  });
  await show({fromAccountId: seed.cash});
  await fireEvent.press(screen.getByLabelText(/accounts\.toAccountA11y/));
  expect(screen.getByText('accounts.sameAccount')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '10');
  expect(screen.getByRole('button', {name: /accounts\.(transfer|moveAmount)/})).toBeDisabled();
});

it('an edit changes only what was changed, and Delete asks first', async () => {
  const id = await createTransfer(seed.userId, {
    fromAccountId: seed.bank,
    toAccountId: seed.fund,
    amount: 1000,
    date: today,
    note: 'SIP',
  });
  await show({transferId: id});
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '1200');
  await fireEvent.press(screen.getByText('common.update'));
  await settle();
  expect(await getTransferById(id)).toMatchObject({
    amount: 1200,
    note: 'SIP',
    fromAccountId: seed.bank,
    toAccountId: seed.fund,
  });
  await show({transferId: id});
  await fireEvent.press(screen.getByText('common.delete'));
  await settle();
  expect(dialogsSaid()).toEqual(['warning: accounts.deleteTransferConfirm']);
  expect(await getTransferById(id)).toBeNull();
});

it('editing a transfer deleted elsewhere says so and cannot save it as a new one', async () => {
  await show({transferId: 'gone'});
  expect(screen.getByText('common.recordMissing')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '10');
  expect(screen.getByRole('button', {name: 'common.update'})).toBeDisabled();
  expect(await transfers()).toEqual([]);
});

it('paying a card bill starts with the card, what is owed, and the default account to pay from', async () => {
  await show({toAccountId: seed.card, amount: 1500});
  expect(screen.getByLabelText('transaction.amountLabel').props['value']).toBe('1500');
  await fireEvent.press(screen.getByRole('button', {name: /accounts\.moveAmount/}));
  await settle();
  const [row] = await transfers();
  expect(row).toMatchObject({from_account_id: seed.cash, to_account_id: seed.card, amount: 1500, date: today});
});

it('swap exchanges the two sides', async () => {
  await show({fromAccountId: seed.bank});
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '100');
  await fireEvent.press(screen.getByLabelText('accounts.swap'));
  await fireEvent.press(screen.getByRole('button', {name: /accounts\.moveAmount/}));
  await settle();
  const [row] = await transfers();
  expect(row).toMatchObject({to_account_id: seed.bank, amount: 100});
  expect(row?.['from_account_id']).not.toBe(seed.bank);
});

it('each side shows what it holds now and after the move, so no account is picked blind', async () => {
  setMockTranslations({'accounts.balanceAfter': '{{now}} to {{after}}'});
  await show({fromAccountId: seed.bank, toAccountId: seed.fund});
  await fireEvent.changeText(screen.getByLabelText('transaction.amountLabel'), '2000');
  await settle();
  // HDFC holds 5,000 and will hold 3,000; the fund 9,000 and will hold 11,000.
  expect(screen.getByText(/5,000.* to .*3,000/)).toBeTruthy();
  expect(screen.getByText(/9,000.* to .*11,000/)).toBeTruthy();
  setMockTranslations({});
});
