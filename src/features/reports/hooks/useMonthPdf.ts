import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useStore} from 'react-redux';
import type {RootState} from '../../../store/rootReducer';
import {selectExpenseData, selectMonthRefunds} from '../../../store/slices/expenseDataSlice';
import {displayCategoryName} from '../../../i18n/displayNames';
import type {Period} from '../../../domain/period';
import {daysIn} from '../../../domain/period';
import {formatMonthLabel} from '../../../platform/dateFormat';
import {spendingReportDoc} from '../reportDocs';
import {useReportWords} from './useReportWords';
import {useSharePdf} from './useSharePdf';

/** No year is "this year" to a document: every label names its year. */
const NO_CURRENT_YEAR = 0;

interface MonthOnScreen {
  yearMonth: string;
  period: Period;
  received: number;
  /** The overall budget the screen shows for the month, or null. */
  budget: number | null;
}

/**
 * "Share as PDF" for the month Reports is showing (3.0, plan P12). The rows
 * are the ones on screen, read from the store at the tap: the report cannot
 * hold a row the screen does not.
 */
export const useMonthPdf = (month: MonthOnScreen) => {
  const {t} = useTranslation();
  const {words, format} = useReportWords();
  const {share, sharing} = useSharePdf();
  // The store itself, not a selector: the rows are read at the tap, and this hook redraws for none of them.
  const store = useStore<RootState>();
  const {yearMonth, period, received, budget} = month;

  const sharePdf = useCallback(
    () =>
      share(() => {
        const state = store.getState();
        return spendingReportDoc(
          {
            // With its year, whatever year it is now: a document is read later.
            periodLabel: formatMonthLabel(period, 'monthYearLong', NO_CURRENT_YEAR),
            days: daysIn(period),
            expenses: selectExpenseData(state, yearMonth),
            refunds: selectMonthRefunds(state, yearMonth),
            received,
            budget,
            categoryName: name => displayCategoryName(name, t),
          },
          words,
          format,
        );
      }, `zero ${period.start}`),
    [share, store, yearMonth, period, received, budget, words, format, t],
  );

  return {sharePdf, sharing};
};
