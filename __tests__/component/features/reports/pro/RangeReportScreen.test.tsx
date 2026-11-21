/**
 * Reports for a picked range (3.0 Pro, P11): the range's own total, daily
 * average and "where it went", with no budget and no drill-down (those are a
 * month's); and "Share as PDF" hands over exactly the range on screen. Real
 * LokiJS database; the date picker and the PDF module are stand-ins.
 */
import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {RangeReportScreen} from '../../../../../src/features/reports/pro/RangeReportScreen';
import * as reportPdf from '../../../../../src/pro/reportPdf';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {REPORTS_NOW, seedReports} from '../../../../harness/reportsSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
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
  jest.useFakeTimers({now: REPORTS_NOW, advanceTimers: true});
  setEntitlement({state: 'lifetime'});
  await seedReports();
  setMockTranslations({
    'common.fieldValue': '{{field}}, {{value}}',
    'reports.rangeDays': '{{count}} days',
    'reports.rangeBack': '{{amount}} came back in these days',
    'reports.rangeLabel': '{{from}} – {{to}}',
    // The seed's categories are default names, shown through their translations.
    'defaultCategories.food': 'Food',
  });
});
afterAll(() => {
  jest.useRealTimers();
  setMockTranslations({});
  setEntitlement();
});
afterEach(() => jest.restoreAllMocks());

const show = async () => {
  await renderInApp(<RangeReportScreen />);
  await waitFor(() => expect(screen.getByLabelText(/^reports\.total, /)).toBeTruthy());
};

it('shows the last 30 days: the total, the daily average, what came back, the calendar and the categories', async () => {
  await show();
  expect(screen.getByText('30 days')).toBeTruthy();
  // 400 + 900 + 450 + 20 − 300 over 30 days.
  expect(screen.getByLabelText('reports.total, ₹1470')).toBeTruthy();
  expect(screen.getByLabelText('reports.avgPerDay, ₹49')).toBeTruthy();
  expect(screen.getByText('₹300 came back in these days')).toBeTruthy();
  // One calendar cell per day of the range.
  expect(
    screen.getAllByRole('button').filter(node => /2026/.test(String(node.props['accessibilityLabel']))),
  ).toHaveLength(
    30 + 2, // the thirty days and the two date fields
  );
  expect(screen.getByText('Food')).toBeTruthy();
  expect(screen.getByText('Fuel')).toBeTruthy();
});

it('has no budget, and a category does not open a month’s list', async () => {
  await show();
  expect(screen.queryByText('reports.setBudget')).toBeNull();
  await fireEvent.press(screen.getByText('Food'));
  expect(navigate).not.toHaveBeenCalledWith('CategoryTransactionScreen', expect.anything());
});

it('"Share as PDF" hands over the range on screen, headed by its days', async () => {
  const shared = jest.spyOn(reportPdf, 'shareReportPdf').mockResolvedValue('shared');
  await show();
  await act(async () => {
    await fireEvent.press(screen.getByText('reports.sharePdf'));
  });
  const [doc, name] = shared.mock.calls[0] ?? [];
  expect(name).toBe('zero 2026-10-17 2026-11-15');
  expect(doc?.subtitle).toMatch(/17.*2026 – .*15.*2026/);
  const text = JSON.stringify(doc);
  expect(text).toContain('Feast');
  expect(text).not.toContain('Groceries'); // 5 October is before the range
  expect(text).not.toContain('pdfBudget');
});

it('without the reports feature there is no PDF button (the tier decides, not the screen)', async () => {
  await act(async () => setEntitlement({state: 'expired'}));
  await show();
  expect(screen.queryByText('reports.sharePdf')).toBeNull();
  await act(async () => setEntitlement({state: 'lifetime'}));
});
