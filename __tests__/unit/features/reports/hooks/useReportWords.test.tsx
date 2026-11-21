/** The words a PDF is written with (plan P12): the app's own copy, whole sentences, and its money and dates. */
import {useReportWords} from '../../../../../src/features/reports/hooks/useReportWords';
import {setMockTranslations} from '../../../../harness/mocks/reactI18next';
import {renderHookInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
afterEach(() => setMockTranslations({}));

it('takes every word from the app’s copy and fills the sentences that carry figures', async () => {
  setMockTranslations({
    'reports.pdfRefundedLine': 'Refunded: {{amount}}',
    'reports.pdfBudgetLeftLine': 'Budget: {{budget}}. {{amount}} left.',
    'reports.pdfBudgetOverLine': 'Budget: {{budget}}. {{amount}} over.',
    'reports.pdfRefundOf': 'Refund: {{title}}',
    'reports.pdfTooManyEntries': '{{count}} entries are not listed',
    'reports.pdfFooter': 'Made on this phone with zero · {{date}}',
  });
  const {result} = await renderHookInApp(() => useReportWords());
  const {words, format} = result.current;
  expect(words.spendingTitle).toBe('reports.pdfSpendingTitle');
  expect(words.direction).toBe('ltr');
  expect(words.footer).toMatch(/^Made on this phone with zero · .*\d{4}$/);
  expect(words.refundedLine('₹5')).toBe('Refunded: ₹5');
  expect(words.budgetLeftLine('₹100', '₹40')).toBe('Budget: ₹100. ₹40 left.');
  expect(words.budgetOverLine('₹100', '₹40')).toBe('Budget: ₹100. ₹40 over.');
  expect(words.refundOf('Boots')).toBe('Refund: Boots');
  expect(words.tooManyEntries(501)).toBe('501 entries are not listed');
  // The app's own formats: a figure as the screens show it, a stored date as a short day.
  expect(format.money(1234.5)).toMatch(/1,?234/);
  expect(format.day('2026-11-07T10:00:00')).toMatch(/7/);
  expect(format.day('2026-11-07T10:00:00')).not.toMatch(/2026/);
});
