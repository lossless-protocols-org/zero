/**
 * Home's budget card as a meter (ZERO_3.0_TO_FIX_APPROVED A5): the card is the
 * budget divided into spent, free and bills still due, with one line under it.
 * Every state the approved design lists is rendered here from the figures
 * `budgetStatus` gives, so the card and the maths cannot drift apart.
 */
import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, screen, within} from '@testing-library/react-native';
import {BudgetMeter} from '../../../../src/ui/molecules/BudgetMeter';
import {budgetStatus} from '../../../../src/domain/budgetMath';
import {renderWithTheme, themeColors} from '../../../harness/render';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';

// The currency comes from the session; the meter only needs a formatter.
jest.mock('../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));
jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

const mockWindow = {width: 360, height: 800, scale: 2, fontScale: 1};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

beforeAll(() => {
  setMockTranslations({
    'home.meterTodayLeft': 'Today {{amount}} left',
    'home.amountLeftToday': '{{amount}} left today',
    'home.amountOverToday': '{{amount}} over today',
    'home.meterBillsDue': 'Bills due {{amount}}',
    'home.meterFreeOf': '{{amount}} free of {{budget}}',
    'home.meterOverOf': '{{amount}} over the {{budget}} budget',
    'home.meterHeldForBills': '{{amount}} held for bills',
  });
});

beforeEach(() => {
  mockWindow.fontScale = 1;
});

/** A 30,000 budget on day 11 of 30, as Home reads it. */
const status = (over: Partial<Parameters<typeof budgetStatus>[0]> = {}) =>
  budgetStatus({
    budget: 30000,
    spent: 18400,
    spentToday: 100,
    dayOfMonth: 11,
    daysInMonth: 30,
    isCurrentMonth: true,
    billsStillDue: 3200,
    ...over,
  });

const onBillsPress = jest.fn();
const renderMeter = (meterStatus: ReturnType<typeof budgetStatus>, isCurrentMonth = true) =>
  renderWithTheme(<BudgetMeter status={meterStatus} isCurrentMonth={isCurrentMonth} onBillsPress={onBillsPress} />);

/** A part's share of the meter: its flex weight. */
const share = (testID: string): number => Number(StyleSheet.flatten(screen.getByTestId(testID).props['style']).flex);

it('divides the budget into spent, free and bills, with the free amount inside its part', async () => {
  await renderMeter(status());
  expect(share('budget-meter-spent')).toBeCloseTo(61.33, 1);
  expect(share('budget-meter-free')).toBeCloseTo(28, 1);
  expect(share('budget-meter-bills')).toBeCloseTo(10.67, 1);
  // "Spent" has no amount; the month card above shows it.
  expect(within(screen.getByTestId('budget-meter-spent')).getByText('home.meterSpent')).toBeOnTheScreen();
  expect(screen.queryByText('₹18400')).toBeNull();
  // 28% is under the free label's threshold here, so see the wide case below for "inside".
  expect(screen.getByText('₹8400')).toBeOnTheScreen();
  expect(screen.getByText('Today ₹325 left')).toBeOnTheScreen();
  expect(screen.getByText('Bills due ₹3200')).toBeOnTheScreen();
});

it('puts "Free" and its amount inside the free part when it is wide enough', async () => {
  await renderMeter(status({spent: 9000}));
  const free = within(screen.getByTestId('budget-meter-free'));
  expect(free.getByText('home.meterFree')).toBeOnTheScreen();
  expect(free.getByText('₹17800')).toBeOnTheScreen();
});

it('reads as one sentence and keeps the bills link reachable', async () => {
  await renderMeter(status({spent: 9000}));
  const card = screen.getByTestId('budget-meter');
  expect(card.props['accessible']).toBe(true);
  expect(card.props['accessibilityLabel']).toBe('₹17800 free of ₹30000, ₹795 left today, ₹3200 held for bills');
  expect(card.props['accessibilityActions']).toEqual([{name: 'bills', label: 'home.meterOpenBills'}]);

  await fireEvent(card, 'accessibilityAction', {nativeEvent: {actionName: 'bills'}});
  expect(onBillsPress).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button'));
  expect(onBillsPress).toHaveBeenCalledTimes(2);
});

it('moves the free label under the meter when its part is too thin for it', async () => {
  await renderMeter(status({spent: 25000}));
  const free = screen.getByTestId('budget-meter-free');
  expect(share('budget-meter-free')).toBeCloseTo(6, 1);
  expect(within(free).queryByText('home.meterFree')).toBeNull();
  expect(within(free).queryByText('₹1800')).toBeNull();
  // Still on the card, under the meter.
  expect(screen.getByText('home.meterFree')).toBeOnTheScreen();
  expect(screen.getByText('₹1800')).toBeOnTheScreen();
});

it('leaves a thin spent part unlabelled', async () => {
  await renderMeter(status({spent: 1500, billsStillDue: 0}));
  expect(share('budget-meter-spent')).toBeCloseTo(5, 1);
  expect(screen.queryByText('home.meterSpent')).toBeNull();
});

it('over budget: no free part, the spent part is orange and the big figure is the amount over', async () => {
  const colors = await themeColors();
  await renderMeter(status({spent: 32500}));
  expect(screen.queryByTestId('budget-meter-free')).toBeNull();
  expect(screen.queryByTestId('budget-meter-bills')).toBeNull();
  const spent = screen.getByTestId('budget-meter-spent');
  expect(StyleSheet.flatten(spent.props['style']).backgroundColor).toBe(colors.accentOrange);
  expect(within(spent).getByText('home.meterOver')).toBeOnTheScreen();
  expect(within(spent).getByText('₹2500')).toBeOnTheScreen();
  expect(screen.queryByText('home.meterSpent')).toBeNull();
  expect(screen.getByTestId('budget-meter').props['accessibilityLabel']).toBe(
    '₹2500 over the ₹30000 budget, ₹100 over today, ₹3200 held for bills',
  );
  // The bills are still owed, and still one tap away.
  expect(screen.getByText('Bills due ₹3200')).toBeOnTheScreen();
});

it("today's share used up reads ₹0 left today, in orange", async () => {
  const colors = await themeColors();
  // 11,600 before today, no bills: 18,400 over 20 days is 920 a day, all of it spent today.
  await renderMeter(status({spent: 12520, spentToday: 920, billsStillDue: 0}));
  const today = screen.getByText('₹0 left today');
  expect(StyleSheet.flatten(today.props['style']).color).toBe(colors.accentOrange);
  expect(screen.queryByText(/^Today/)).toBeNull();
});

it("past today's share reads the amount over today, in orange", async () => {
  const colors = await themeColors();
  await renderMeter(status({spent: 13000, spentToday: 1400, billsStillDue: 0}));
  const today = screen.getByText('₹480 over today');
  expect(StyleSheet.flatten(today.props['style']).color).toBe(colors.accentOrange);
});

it('no bills: no striped part, no bills text, no bills action', async () => {
  await renderMeter(status({billsStillDue: 0}));
  expect(screen.queryByTestId('budget-meter-bills')).toBeNull();
  expect(screen.queryByText(/Bills due/)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  const card = screen.getByTestId('budget-meter');
  expect(card.props['accessibilityActions']).toEqual([]);
  expect(card.props['accessibilityLabel']).toBe('₹11600 free of ₹30000, ₹485 left today');
  expect(share('budget-meter-spent') + share('budget-meter-free')).toBeCloseTo(100, 5);
});

it('a past month has no "today"', async () => {
  await renderMeter(status({isCurrentMonth: false, spentToday: 0}), false);
  expect(screen.queryByText(/today/i)).toBeNull();
  // Bills belong to the current month only (budgetStatus), so nothing is under the meter.
  expect(screen.queryByText(/Bills due/)).toBeNull();
  expect(screen.getByTestId('budget-meter').props['accessibilityLabel']).toBe('₹11600 free of ₹30000');
  expect(within(screen.getByTestId('budget-meter-free')).getByText('₹11600')).toBeOnTheScreen();
});

it('at large system text every label drops below the meter', async () => {
  mockWindow.fontScale = 1.5;
  await renderMeter(status({spent: 9000}));
  expect(within(screen.getByTestId('budget-meter-free')).queryByText('₹17800')).toBeNull();
  expect(within(screen.getByTestId('budget-meter-spent')).queryByText('home.meterSpent')).toBeNull();
  expect(screen.getByText('home.meterFree')).toBeOnTheScreen();
  expect(screen.getByText('₹17800')).toBeOnTheScreen();
  expect(screen.getByText('Today ₹795 left')).toBeOnTheScreen();
});
