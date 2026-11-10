import React, {memo} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {keptOf} from '../../../domain/periodMath';
import {gs} from '../../../ui/globalStyles';

interface MoneyInStripProps {
  colors: ThemeColors;
  received: number;
  /** Net of refunds (R2). */
  spent: number;
  refunded: number;
}

/**
 * Reports' Money-in strip (2.8): Received, Spent, Kept for the month with a
 * two-bar comparison, and what came back. A strip, not a second donut: the
 * donut and the heatmap answer "where did it go" and stay spending only.
 */
const MoneyInStripComponent: React.FC<MoneyInStripProps> = ({colors, received, spent, refunded}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const kept = keptOf(received, spent);
  const scale = Math.max(received, spent, 0);
  const bar = (value: number) => `${scale > 0 ? Math.max(0, Math.min(100, (value / scale) * 100)) : 0}%` as const;
  const figure = (label: string, value: string, color: string) => (
    <View style={[gs.flex1, gs.gap2]} accessible accessibilityLabel={t('common.fieldValue', {field: label, value})}>
      <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
        {label}
      </PrimaryText>
      <Amount color={color}>{value}</Amount>
    </View>
  );

  return (
    <View style={[gs.px14, gs.py12, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
      <PrimaryText size={12} weight="semibold" color={colors.secondaryText} style={gs.mb8} accessibilityRole="header">
        {t('reports.moneyIn')}
      </PrimaryText>
      <View style={[gs.row, gs.gap8]}>
        {figure(t('reports.received'), formatAmount(received), colors.accentGreen)}
        {figure(t('reports.spent'), formatAmount(spent), colors.primaryText)}
        {/* Kept below zero is said in neutral colour, not as an alarm (R4). */}
        {figure(t('reports.kept'), formatAmount(kept), colors.primaryText)}
      </View>
      <View style={[gs.mt10, gs.gap6]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[gs.h4, gs.rounded4, {backgroundColor: colors.secondaryContainerColor}]}>
          <View style={[gs.h4, gs.rounded4, {width: bar(received), backgroundColor: colors.accentGreen}]} />
        </View>
        <View style={[gs.h4, gs.rounded4, {backgroundColor: colors.secondaryContainerColor}]}>
          <View style={[gs.h4, gs.rounded4, {width: bar(spent), backgroundColor: colors.secondaryText}]} />
        </View>
      </View>
      {refunded > 0 ? (
        <Amount weight="medium" size={11} color={colors.secondaryText} style={gs.mt8}>
          {t('reports.monthBack', {amount: formatAmount(refunded)})}
        </Amount>
      ) : null}
    </View>
  );
};

export const MoneyInStrip = memo(MoneyInStripComponent);
