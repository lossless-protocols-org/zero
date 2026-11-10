import React from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from './PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {useFormatAmount} from '../hooks/useFormatAmount';

interface DailyBudgetRowProps {
  dailyBudget: number;
  dailyLeft: number;
  isCurrentMonth: boolean;
}

/**
 * "~₹1,000/day · ₹400 left today". Reads its own colours, language and
 * currency like every other atom; callers pass only the figures (it used to
 * take `t`, `formatAmount` and `colors` as props, audit 2026-11-08 §5).
 */
export const DailyBudgetRow = React.memo(({dailyBudget, dailyLeft, isCurrentMonth}: DailyBudgetRowProps) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const exceeded = dailyLeft < 0;
  const dailyLabel = t('home.perDayAmount', {amount: formatAmount(Math.round(dailyBudget))});

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
          ? t('home.amountOverToday', {amount: formatAmount(Math.round(Math.abs(dailyLeft)))})
          : t('home.amountLeftToday', {amount: formatAmount(Math.round(dailyLeft))})}
      </PrimaryText>
    </PrimaryText>
  );
});
