import type {LinkingOptions} from '@react-navigation/native';
import type {HomeStackParamList} from './types';
import {isYearMonth} from '../domain/dates';

/**
 * zero:// links (2.8): the home-screen widget's actions. Ids and kinds
 * only, never display data (M19). The add screens open ON TOP of the tab
 * stack (`initialRouteName`), so Back from a widget-opened form lands on Home
 * rather than leaving the app. The widget body is not a link: it opens zero
 * as the launcher icon does, back to whatever was on screen.
 *   zero://add        add an expense (the full form)
 *   zero://money/add  add money in (the full form); ?yearMonth=YYYY-MM starts its date in that
 *                     month, and anything else in that slot is dropped (any app can send a link)
 *   zero://quick?kind=expense|income&categoryId=…[&amount=…&title=…]
 *                     the quick-add sheet over the app (iOS widget taps); amount and title
 *                     fill it in ("Add again" from the Home Screen quick actions). Only a
 *                     plain amount ("20", "12.5") and a short title get through: any app can
 *                     send a link, and the sheet still waits for Save
 * Anything else opens the app where it was.
 */
/** A plain positive amount as typed ("20", "12.5"), else nothing. */
const parseQuickAmount = (value: string): string | undefined =>
  /^\d{1,12}(\.\d{1,6})?$/.test(value) && Number(value) > 0 ? value : undefined;

/** The longest title a link may fill in; longer is cut, not refused. */
const QUICK_TITLE_MAX = 100;

/** A title to fill in: trimmed and cut to length, nothing when empty. */
const parseQuickTitle = (value: string): string | undefined => {
  const title = value.trim().slice(0, QUICK_TITLE_MAX);
  return title.length > 0 ? title : undefined;
};

export const deepLinking: LinkingOptions<HomeStackParamList> = {
  prefixes: ['zero://'],
  config: {
    initialRouteName: 'TabStack',
    screens: {
      AddTransactionsScreen: 'add',
      AddIncomeScreen: {
        path: 'money/add',
        parse: {yearMonth: (value: string) => (isYearMonth(value) ? value : undefined)},
      },
      QuickAddScreen: {
        path: 'quick',
        parse: {amount: parseQuickAmount, title: parseQuickTitle},
      },
    },
  },
};
