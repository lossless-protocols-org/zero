import React from 'react';
import type {TFunction} from 'i18next';
import PrimaryText from './PrimaryText';
import type {ThemeColors} from '../../hooks/useThemeColors';

interface DailyBudgetRowProps {
  dailyBudget: number;
  dailyLeft: number;
  isCurrentMonth: boolean;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
  t: TFunction;
}

const DailyBudgetRow = React.memo(
  ({dailyBudget, dailyLeft, isCurrentMonth, colors, formatAmount, t}: DailyBudgetRowProps) => {
    const exceeded = dailyLeft < 0;
    const dailyLabel = `~${formatAmount(Math.round(dailyBudget))}/${t('home.perDay')}`;

    if (!isCurrentMonth) {
      return (
        <PrimaryText size={11} variant="number" color={colors.secondaryText}>
          {dailyLabel}
        </PrimaryText>
      );
    }

    // One paragraph (nested texts), so at large system text it wraps onto a
    // second line instead of running off the card (seen on an iPhone 16).
    return (
      <PrimaryText size={11} variant="number" color={colors.secondaryText}>
        {dailyLabel}
        {' · '}
        <PrimaryText
          size={11}
          weight="semibold"
          variant="number"
          color={exceeded ? colors.accentOrange : colors.accentGreen}>
          {exceeded
            ? formatAmount(Math.round(Math.abs(dailyLeft))) + ' ' + t('home.overToday')
            : formatAmount(Math.round(dailyLeft)) + ' ' + t('home.leftToday')}
        </PrimaryText>
      </PrimaryText>
    );
  },
);

export default DailyBudgetRow;
