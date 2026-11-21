import type {TFunction} from 'i18next';
import type {Insight} from '../../domain/trends';

/**
 * An insight in words (3.0, plan P12). Each sentence states a comparison of
 * the user's own figures and shows them, so it can be checked against the
 * screen; none predicts and none advises. The facts are domain/trends'.
 */
export const insightText = (
  insight: Insight,
  t: TFunction,
  money: (amount: number) => string,
  categoryName: (categoryId: string) => string,
): string => {
  switch (insight.kind) {
    case 'spentAboveAverage':
    case 'spentBelowAverage':
      return t(insight.kind === 'spentAboveAverage' ? 'trends.insightSpentAbove' : 'trends.insightSpentBelow', {
        percent: insight.percent,
        months: insight.months,
        spent: money(insight.spent),
        average: money(insight.average),
      });
    case 'categoryAboveAverage':
    case 'categoryBelowAverage':
      return t(
        insight.kind === 'categoryAboveAverage' ? 'trends.insightCategoryAbove' : 'trends.insightCategoryBelow',
        {
          name: categoryName(insight.categoryId),
          percent: insight.percent,
          months: insight.months,
          spent: money(insight.spent),
          average: money(insight.average),
        },
      );
    case 'biggestCategory':
      return t('trends.insightBiggest', {
        name: categoryName(insight.categoryId),
        percent: insight.percent,
        spent: money(insight.spent),
      });
    case 'highestOfMonths':
      return t('trends.insightHighest', {months: insight.months});
    case 'lowestOfMonths':
      return t('trends.insightLowest', {months: insight.months});
    case 'keptShare':
      return t('trends.insightKept', {
        percent: insight.percent,
        kept: money(insight.kept),
        received: money(insight.received),
      });
    case 'spentMoreThanReceived':
      return t('trends.insightOver', {over: money(insight.over), received: money(insight.received)});
  }
};
