import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
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
  /** Pro (P8): what balances set by hand explained this month; 0 hides the line. */
  unexplained?: number;
}

/**
 * Reports' Money-in card (2.8; round two item 2): the month's money in as
 * one bar, split into what was spent and what was kept, since the three
 * figures are one sum (in = spent + kept). It is the budget meter's shape,
 * so the app draws a sum one way. Spending past what came in is a red end on
 * the bar, said in words under it. A card, not a second donut: the donut and
 * the heatmap answer "where did it go" and stay spending only.
 */
const MoneyInStripComponent: React.FC<MoneyInStripProps> = ({colors, received, spent, refunded, unexplained = 0}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const kept = keptOf(received, spent);
  const over = kept < 0;
  // The bar is as long as the larger of the two; its parts are shares of that.
  const whole = Math.max(received, spent, 0);
  const share = (value: number) => (whole > 0 ? Math.max(0, Math.min(100, (value / whole) * 100)) : 0);
  const spentShare = share(over ? received : spent);
  const endShare = share(over ? -kept : kept);
  const figure = (label: string, value: string, color: string, swatch?: string) => (
    <View style={gs.gap2} accessible accessibilityLabel={t('common.fieldValue', {field: label, value})}>
      <View style={[gs.rowCenter, gs.gap4]}>
        {swatch ? <View style={[styles.swatch, {backgroundColor: swatch}]} /> : null}
        <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
          {label}
        </PrimaryText>
      </View>
      <Amount color={color}>{value}</Amount>
    </View>
  );

  return (
    <View style={[gs.px14, gs.py12, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
      <View
        style={[gs.rowBetweenCenter, gs.gap8, gs.mb8]}
        accessible
        accessibilityLabel={t('common.fieldValue', {field: t('reports.moneyIn'), value: formatAmount(received)})}>
        <PrimaryText size={12} weight="semibold" color={colors.secondaryText} accessibilityRole="header">
          {t('reports.moneyIn')}
        </PrimaryText>
        <Amount weight="semibold" color={colors.accentGreen}>
          {formatAmount(received)}
        </Amount>
      </View>
      {whole > 0 ? (
        <View
          style={[
            gs.row,
            gs.rounded4,
            gs.overflowHidden,
            styles.bar,
            {backgroundColor: colors.secondaryContainerColor},
          ]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          testID="money-in-bar">
          <View testID="money-in-spent" style={{width: `${spentShare}%`, backgroundColor: colors.secondaryText}} />
          <View style={styles.gap} />
          <View
            testID="money-in-end"
            style={{width: `${endShare}%`, backgroundColor: over ? colors.accentRed : colors.accentGreen}}
          />
        </View>
      ) : null}
      <View style={[gs.row, gs.wrap, gs.justifyBetween, gs.gap8, gs.mt10]}>
        {figure(t('reports.spent'), formatAmount(spent), colors.primaryText, colors.secondaryText)}
        {over
          ? figure(t('reports.overCameIn'), formatAmount(-kept), colors.accentRed, colors.accentRed)
          : figure(t('reports.kept'), formatAmount(kept), colors.primaryText, colors.accentGreen)}
      </View>
      {refunded > 0 ? (
        <Amount weight="medium" size={11} color={colors.secondaryText} style={gs.mt8}>
          {t('reports.monthBack', {amount: formatAmount(refunded)})}
        </Amount>
      ) : null}
      {/* Not a flow and not in Kept: the part of the month only a balance you set explains. */}
      {unexplained !== 0 ? (
        <Amount weight="medium" size={11} color={colors.secondaryText} style={gs.mt4}>
          {t(unexplained > 0 ? 'reports.unexplainedMore' : 'reports.unexplainedLess', {
            amount: formatAmount(Math.abs(unexplained)),
          })}
        </Amount>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {height: 14},
  // The surface shows between the two parts, as between the meter's.
  gap: {width: 2},
  swatch: {width: 8, height: 8, borderRadius: 2},
});

export const MoneyInStrip = memo(MoneyInStripComponent);
