import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {formatBalance} from '../../../ui/accountWords';
import {navigate} from '../../../platform/navigationUtils';
import {gs} from '../../../ui/globalStyles';

/**
 * Net worth as one quiet line at the foot of the Money and the Debts tab
 * (round two, items 4 and 5): what is held less what is owed belongs to
 * neither tab alone, so the same line closes both and opens the sum. Red
 * below zero, beside its minus sign. Pro: mounted only with accounts on.
 */
export const NetWorthLine: React.FC<{total: number}> = ({total}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const figure = formatBalance(formatAmount, total);
  return (
    <TouchableOpacity
      onPress={() => navigate('NetWorthScreen')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('common.fieldValue', {field: t('accounts.netWorthTitle'), value: figure})}
      accessibilityHint={t('accounts.heldLessOwed')}
      testID="net-worth-line"
      style={[gs.rowBetweenCenter, gs.px3, gs.py12, gs.mb15, gs.minH45]}>
      <PrimaryText size={13} color={colors.secondaryText}>
        {t('accounts.netWorthTitle')}
      </PrimaryText>
      <View style={[gs.rowCenter, gs.gap6]}>
        <Amount size={14} weight="semibold" color={total < 0 ? colors.accentRed : colors.primaryText}>
          {figure}
        </Amount>
        <Icon name="chevron-right" size={14} color={colors.secondaryText} />
      </View>
    </TouchableOpacity>
  );
};
