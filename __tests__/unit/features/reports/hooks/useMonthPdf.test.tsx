/**
 * This month as a PDF (plan P12): the document is built at the tap from the
 * rows the screen holds in the store for that month, and from nothing else.
 */
import {act} from '@testing-library/react-native';
import {useMonthPdf} from '../../../../../src/features/reports/hooks/useMonthPdf';
import {store} from '../../../../../src/store/store';
import {fetchExpensesByMonth} from '../../../../../src/store/slices/expenseDataSlice';
import * as reportPdf from '../../../../../src/pro/reportPdf';
import {periodFor} from '../../../../../src/domain/period';
import {seedReports} from '../../../../harness/reportsSeed';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

beforeAll(async () => {
  await seedReports();
});
afterEach(() => jest.restoreAllMocks());

it('holds the month on screen: its rows, its refunds, its money in and its budget', async () => {
  await store.dispatch(fetchExpensesByMonth('2026-10'));
  await store.dispatch(fetchExpensesByMonth('2026-11'));
  const shared = jest.spyOn(reportPdf, 'shareReportPdf').mockResolvedValue('shared');
  const {result} = await renderHookInApp(() =>
    useMonthPdf({
      yearMonth: '2026-11',
      period: periodFor('2026-11'),
      received: 0,
      budget: 2000,
    }),
  );
  await act(() => result.current.sharePdf());
  const [doc, name] = shared.mock.calls[0] ?? [];
  expect(name).toBe('zero 2026-11-01');
  expect(doc?.subtitle).toBe('November 2026');
  const text = JSON.stringify(doc);
  // November's two expenses and the refund dated in it; none of October's rows.
  expect(text).toContain('Chai');
  expect(text).toContain('Petrol');
  expect(text).toContain('reports.pdfRefundOf');
  expect(text).not.toContain('Groceries');
  const stats = doc?.blocks.find(block => block.type === 'stats');
  expect(stats && stats.type === 'stats' ? stats.items.map(item => item.label) : []).toEqual([
    'reports.spent',
    'reports.avgPerDay',
  ]);
  expect(text).toContain('reports.pdfBudgetLeftLine');
});
