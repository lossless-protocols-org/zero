/**
 * The quick-add sheet inside the app (iOS widget taps and, since 2.8, the Home
 * Screen quick actions): a zero://quick link's parameters become the sheet's
 * props. "Add again" carries an amount and a title, and the sheet opens filled
 * in (checked end to end on the simulator, warm and cold, 2026-11-09). The
 * sheet itself has its own suite; here it is a stand-in that shows its props.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {QuickAddScreen} from '../../../../../src/features/widgets/screens/QuickAddScreen';
import type {QuickAddHost} from '../../../../../src/features/widgets/quickAdd/host';

const mockNavigation = {goBack: jest.fn(), replace: jest.fn()};
let mockParams: Record<string, string> | undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({params: mockParams}),
}));

type SheetProps = {kind: string; categoryId: string; prefill?: {amount: string; text: string}; host: QuickAddHost};
const mockSheet = jest.fn<null, [SheetProps]>(() => null);
jest.mock('../../../../../src/features/widgets/quickAdd/QuickAddSheet', () => ({
  QuickAddSheet: (props: SheetProps) => mockSheet(props),
}));

const sheetFor = async (params: Record<string, string> | undefined): Promise<SheetProps> => {
  mockParams = params;
  await render(<QuickAddScreen />);
  const props = mockSheet.mock.calls.at(-1)?.[0];
  if (!props) {
    throw new Error('the sheet was not drawn');
  }
  return props;
};

beforeEach(() => {
  mockSheet.mockClear();
  mockNavigation.goBack.mockClear();
  mockNavigation.replace.mockClear();
});

it('"Add again" opens the sheet filled in: amount, title and category', async () => {
  const props = await sheetFor({kind: 'expense', categoryId: 'cat_food', amount: '35', title: 'Samosa'});
  expect(props).toMatchObject({kind: 'expense', categoryId: 'cat_food', prefill: {amount: '35', text: 'Samosa'}});
});

it('an amount without a title fills in the amount alone', async () => {
  expect((await sheetFor({amount: '20'})).prefill).toEqual({amount: '20', text: ''});
});

it('a widget chip opens the sheet empty, on its category', async () => {
  const props = await sheetFor({kind: 'expense', categoryId: 'cat_fuel'});
  expect(props.prefill).toBeUndefined();
  expect(props.categoryId).toBe('cat_fuel');
});

it('a link with nothing opens an expense sheet; "income" a money-in one', async () => {
  expect(await sheetFor(undefined)).toMatchObject({kind: 'expense', categoryId: ''});
  expect((await sheetFor({kind: 'income'})).kind).toBe('income');
  expect((await sheetFor({kind: 'anything else'})).kind).toBe('expense');
});

it('Close goes back to where the user was; "More details" swaps in the full form', async () => {
  const {host} = await sheetFor({kind: 'expense'});
  host.close();
  expect(mockNavigation.goBack).toHaveBeenCalled();
  host.openFull('income');
  expect(mockNavigation.replace).toHaveBeenLastCalledWith('AddIncomeScreen', {});
  host.openFull('expense');
  expect(mockNavigation.replace).toHaveBeenLastCalledWith('AddTransactionsScreen');
  expect(host.drawsScrim).toBe(true);
  expect(host.dimLeaving(200)).toBeUndefined();
});
