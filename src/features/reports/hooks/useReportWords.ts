import {useMemo} from 'react';
import {I18nManager} from 'react-native';
import {useTranslation} from 'react-i18next';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import type {ReportWords} from '../reportDocs';

/**
 * The words and formatters a PDF report is written with (3.0, plan P12): the
 * app's language, its money format and its dates, so a report reads exactly
 * as the screen it was made from.
 */
export const useReportWords = () => {
  const {t} = useTranslation();
  const money = useFormatAmount();
  return useMemo(() => {
    const words: ReportWords = {
      footer: t('reports.pdfFooter', {date: formatDisplayDate(new Date(), 'date')}),
      direction: I18nManager.isRTL ? 'rtl' : 'ltr',
      spendingTitle: t('reports.pdfSpendingTitle'),
      trendsTitle: t('reports.pdfTrendsTitle'),
      spent: t('reports.spent'),
      received: t('reports.received'),
      kept: t('reports.kept'),
      refundedLine: amount => t('reports.pdfRefundedLine', {amount}),
      avgPerDay: t('reports.avgPerDay'),
      budgetLeftLine: (budget, amount) => t('reports.pdfBudgetLeftLine', {budget, amount}),
      budgetOverLine: (budget, amount) => t('reports.pdfBudgetOverLine', {budget, amount}),
      byCategory: t('reports.pdfByCategory'),
      category: t('reports.pdfCategory'),
      amount: t('reports.pdfAmount'),
      share: t('reports.pdfShare'),
      total: t('reports.total'),
      entries: t('reports.pdfEntries'),
      date: t('reports.pdfDate'),
      title: t('reports.pdfTitle'),
      refundOf: title => t('reports.pdfRefundOf', {title}),
      uncategorised: t('reports.pdfUncategorised'),
      tooManyEntries: count => t('reports.pdfTooManyEntries', {count}),
      noEntries: t('reports.pdfNoEntries'),
      month: t('reports.pdfMonth'),
      whatStoodOut: t('reports.pdfWhatStoodOut'),
    };
    return {words, format: {money, day: (date: string) => formatDisplayDate(date, 'dayMonth')}};
  }, [t, money]);
};
