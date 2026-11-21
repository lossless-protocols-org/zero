/**
 * Trends (3.0 Pro, P12; redesigned as one chart): months as columns that say
 * their figures, the tapped month's money in, spent and kept above them, what
 * stood out in the last finished month as tiles (shares first), and the
 * categories, each of which can take over the chart; with nothing entered it
 * says so. "Share as PDF" hands over the months on screen. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import i18next from 'i18next';
import en from '../../../../../src/i18n/locales/en.json';
import {TrendsScreen} from '../../../../../src/features/reports/pro/TrendsScreen';
import {TREND_CHART_HEIGHT} from '../../../../../src/features/reports/components/TrendColumns';
import * as reportPdf from '../../../../../src/pro/reportPdf';
import * as services from '../../../../harness/services';
import {store} from '../../../../../src/store/store';
import {resetSession} from '../../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../../src/store/slices/userIdSlice';
import {fetchCategories} from '../../../../../src/store/slices/categoryDataSlice';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {REPORTS_NOW, seedReports} from '../../../../harness/reportsSeed';
import {renderInApp} from '../../../../harness/render';

// Real English: this suite reads the words a user reads.
const mockI18n = i18next.createInstance();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: mockI18n.t.bind(mockI18n), i18n: mockI18n}),
}));
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));
jest.mock('../../../../../src/ui/hooks/useFormatAmount', () => ({useFormatAmount: () => (n: number) => `₹${n}`}));

beforeAll(async () => {
  await mockI18n.init({lng: 'en', resources: {en: {translation: en}}, interpolation: {escapeValue: false}});
  jest.useFakeTimers({now: REPORTS_NOW, advanceTimers: true});
  setEntitlement({state: 'lifetime'});
  await seedReports();
});
afterAll(() => {
  jest.useRealTimers();
  setEntitlement();
});
afterEach(() => jest.restoreAllMocks());

/** The chart's columns: buttons that start with their month. */
const columns = () => screen.queryAllByLabelText(/^[A-Z][a-z]+ 20\d\d( so far)?: /);
const labels = () => columns().map(node => String(node.props['accessibilityLabel']));
const show = async () => {
  await renderInApp(<TrendsScreen />);
  await waitFor(() => expect(columns().length).toBeGreaterThan(0));
};
const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props['style']);

it('opens on the last finished month: its money in, spent and kept above the chart', async () => {
  await show();
  // October: 5,000 came in, 1,900 went out.
  expect(screen.getByRole('header', {name: 'Oct 2026'})).toBeTruthy();
  expect(screen.getByLabelText('Money in, ₹5000')).toBeTruthy();
  expect(screen.getByLabelText('Spent, ₹1900')).toBeTruthy();
  expect(screen.getByLabelText('Kept, ₹3100')).toBeTruthy();
  expect(screen.getByText('62% of money in')).toBeTruthy();
  expect(columns().map(node => node.props['accessibilityState'])).toEqual([
    {selected: false},
    {selected: false},
    {selected: false},
    {selected: false},
    {selected: true},
    {selected: false},
  ]);
});

it('draws six months, each column saying its month and three figures; the newest says it is still running', async () => {
  await show();
  expect(labels()).toEqual([
    'June 2026: money in ₹0, spent ₹0, kept ₹0',
    'July 2026: money in ₹0, spent ₹0, kept ₹0',
    'August 2026: money in ₹5000, spent ₹1000, kept ₹4000',
    'September 2026: money in ₹5000, spent ₹1000, kept ₹4000',
    'October 2026: money in ₹5000, spent ₹1900, kept ₹3100',
    'November 2026 so far: money in ₹0, spent ₹170, kept ₹-170',
  ]);
  expect(screen.getByText('your usual spending')).toBeTruthy();
  expect(screen.getByText('Nov is still running')).toBeTruthy();
  // Three finished months have entries: nothing is said about needing more.
  expect(screen.queryByText(/^Trends need two finished months/)).toBeNull();
});

it('a column is as tall as the money in, split into spent and kept; a month with no money in is spending alone', async () => {
  await show();
  // All on one scale: the 5,000 that came in is the full height.
  expect(styleOf('trend-spent-2026-10').height).toBeCloseTo((1900 / 5000) * TREND_CHART_HEIGHT);
  expect(styleOf('trend-kept-2026-10').height).toBeCloseTo((3100 / 5000) * TREND_CHART_HEIGHT - 2);
  expect(screen.queryByTestId('trend-over-2026-10')).toBeNull();
  // November so far: nothing came in, 170 went out.
  expect(styleOf('trend-spent-2026-11').height).toBeCloseTo((170 / 5000) * TREND_CHART_HEIGHT);
  expect(screen.queryByTestId('trend-kept-2026-11')).toBeNull();
  expect(screen.queryByTestId('trend-over-2026-11')).toBeNull();
  expect(styleOf('trend-column-2026-11').opacity).toBe(0.55);
  // The usual spending: 1,300 a month over August to October.
  expect(styleOf('trend-usual-line').bottom).toBeCloseTo(3 + (1300 / 5000) * TREND_CHART_HEIGHT);
});

it('the figures follow the tapped column; the month still running says "so far" and shows kept below zero', async () => {
  await show();
  await fireEvent.press(screen.getByLabelText(/^September 2026: /));
  expect(screen.getByRole('header', {name: 'Sep 2026'})).toBeTruthy();
  expect(screen.getByLabelText('Spent, ₹1000')).toBeTruthy();
  expect(screen.getByLabelText('Kept, ₹4000')).toBeTruthy();
  expect(screen.getByLabelText(/^September 2026: /).props['accessibilityState']).toEqual({selected: true});

  await fireEvent.press(screen.getByLabelText(/^November 2026 so far: /));
  expect(screen.getByRole('header', {name: 'Nov 2026 so far'})).toBeTruthy();
  expect(screen.getByLabelText('Money in, ₹0')).toBeTruthy();
  expect(screen.getByLabelText('Kept, ₹-170')).toBeTruthy();
  // No money in: no share of it.
  expect(screen.queryByText(/% of money in$/)).toBeNull();
  // Five days are not set against a whole month: no category shows a change.
  expect(screen.getByLabelText('Fuel, ₹450')).toBeTruthy();
});

it('3 months, 6 months or a year', async () => {
  await show();
  expect(screen.getByRole('radio', {name: '6 months'}).props['accessibilityState']).toEqual({checked: true});
  expect(screen.getByText('6M')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', {name: '3 months'}));
  expect(columns()).toHaveLength(3);
  // September and October are the finished months shown: 1,450 a month.
  expect(styleOf('trend-usual-line').bottom).toBeCloseTo(3 + (1450 / 5000) * TREND_CHART_HEIGHT);
  await fireEvent.press(screen.getByText('1Y'));
  expect(columns()).toHaveLength(12);
});

it('what stood out in the last finished month, as tiles: shares first, each a whole sentence to a screen reader', async () => {
  await show();
  expect(screen.getByRole('header', {name: 'Stood out in Oct'})).toBeTruthy();
  const words =
    /^(of money in kept|kept, against your usual|of spending was|spending against your usual|spending of|Food, against)/;
  expect(screen.getAllByText(words).map(node => node.props['children'])).toEqual([
    'of money in kept',
    'kept, against your usual 80%',
    'of spending was Food',
    'spending against your usual',
    'spending of 3 months',
    'Food, against its usual',
  ]);
  expect(screen.getByText('62%')).toBeTruthy();
  expect(screen.getByText('▼ 18 pts')).toBeTruthy();
  expect(screen.getByText('79%')).toBeTruthy();
  expect(screen.getByText('▲ 90%')).toBeTruthy();
  expect(screen.getByText('Highest')).toBeTruthy();

  expect(screen.getByLabelText('You kept 62% of the money that came in (₹3100 of ₹5000).')).toBeTruthy();
  expect(screen.getByLabelText('You kept 62% of the money that came in, 18 points below your usual 80%.')).toBeTruthy();
  expect(screen.getByLabelText('Food was the biggest category: 79% of spending (₹1500).')).toBeTruthy();
  expect(
    screen.getByLabelText('You spent 90% more than your average of the 2 months before (₹1900 against ₹1000).'),
  ).toBeTruthy();
  expect(screen.getByLabelText('It was the highest spending of these 3 months.')).toBeTruthy();
  expect(
    screen.getByLabelText('Food was 150% above its average of the 2 months before (₹1500 against ₹600).'),
  ).toBeTruthy();
});

it('the categories of the months shown, with the selected month’s amount and its change', async () => {
  await show();
  expect(screen.getByRole('header', {name: 'Categories'})).toBeTruthy();
  // October's food against September's 600; fuel was the same, and says no change.
  expect(screen.getByLabelText('Food, ₹1500, 150% more than Sep 2026')).toBeTruthy();
  expect(screen.getByLabelText('Fuel, ₹400')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^September 2026: /));
  expect(screen.getByLabelText('Food, ₹600')).toBeTruthy();
});

it('tapping a category shows it in the chart; tapping it again, or "All spending", brings all spending back', async () => {
  await show();
  expect(screen.queryByText('All spending')).toBeNull();
  await fireEvent.press(screen.getByLabelText(/^Fuel, /));
  expect(labels().slice(-4)).toEqual([
    'August 2026: ₹400',
    'September 2026: ₹400',
    'October 2026: ₹400',
    'November 2026 so far: ₹450',
  ]);
  expect(screen.getByLabelText(/^Fuel, /).props['accessibilityState']).toEqual({selected: true});
  // Its spending only: one figure, one colour, on its own scale (November's 450).
  expect(screen.getByLabelText('Spent on Fuel, ₹400')).toBeTruthy();
  expect(screen.queryByLabelText(/^Kept, /)).toBeNull();
  expect(screen.queryByLabelText(/^Money in, /)).toBeNull();
  expect(screen.queryByTestId('trend-kept-2026-10')).toBeNull();
  expect(styleOf('trend-spent-2026-10').height).toBeCloseTo((400 / 450) * TREND_CHART_HEIGHT);

  // The same row again.
  await fireEvent.press(screen.getByLabelText(/^Fuel, /));
  expect(screen.queryByText('All spending')).toBeNull();
  expect(screen.getByLabelText('Kept, ₹3100')).toBeTruthy();
  expect(screen.getByTestId('trend-kept-2026-10')).toBeTruthy();

  // Another category, then the chip.
  await fireEvent.press(screen.getByLabelText(/^Food, /));
  expect(screen.getByLabelText('Spent on Food, ₹1500')).toBeTruthy();
  await fireEvent.press(screen.getByText('All spending'));
  expect(screen.queryByText('All spending')).toBeNull();
  expect(labels().at(-2)).toBe('October 2026: money in ₹5000, spent ₹1900, kept ₹3100');
});

it('"Share as PDF" hands over the months on screen and the sentences', async () => {
  const shared = jest.spyOn(reportPdf, 'shareReportPdf').mockResolvedValue('shared');
  await show();
  await act(async () => {
    await fireEvent.press(screen.getByLabelText('Share as PDF'));
  });
  const [doc, name] = shared.mock.calls[0] ?? [];
  expect(name).toBe('zero trends 2026-06 2026-11');
  expect(doc).toMatchObject({title: 'Trends', subtitle: 'Jun 2026 – Nov 2026'});
  const text = JSON.stringify(doc);
  expect(text).toContain('What stood out in Oct 2026');
  expect(text).toContain('You spent 90% more than your average of the 2 months before');
  expect(text).toContain('₹4070');
});

it('with nothing entered yet it says so, and draws no chart', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  await services.createUser('New', '');
  await store.dispatch(fetchUserData());
  await renderInApp(<TrendsScreen />);
  await waitFor(() =>
    expect(screen.getByText('Trends appear once you have entries in more than one month.')).toBeTruthy(),
  );
  expect(columns()).toHaveLength(0);
});

it('with one finished month it draws what there is and says trends need two', async () => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  const userId = await services.createUser('New', '');
  const food = await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  await services.createExpense(userId, 'Groceries', 600, '', food, '2026-10-05T10:00:00');
  await services.createExpense(userId, 'Chai', 20, '', food, '2026-11-15T08:00:00');
  await store.dispatch(fetchUserData());
  await store.dispatch(fetchCategories());
  await show();
  expect(columns()).toHaveLength(6);
  expect(screen.getByText('Trends need two finished months. Until then, this shows what there is.')).toBeTruthy();
  // No average is made up from one month.
  expect(screen.queryByTestId('trend-usual-line')).toBeNull();
  expect(screen.queryByText('your usual spending')).toBeNull();
  // No money in: October is its spending alone, the full height.
  expect(styleOf('trend-spent-2026-10').height).toBeCloseTo(TREND_CHART_HEIGHT);
  // What can be said of one month is still said.
  expect(screen.getByLabelText('Food was the biggest category: 100% of spending (₹600).')).toBeTruthy();
});
