import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {useExpenseRefunds} from '../hooks/useExpenseRefunds';
import {navigate} from '../../../platform/navigationUtils';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {netSpent, refundableRemainder} from '../../../domain/periodMath';
import {gs} from '../../../ui/globalStyles';

/**
 * The money that came back on an expense, inside its edit screen (R12: a
 * refund belongs to its expense). Each refund opens for editing; "Got money
 * back" stays while anything is left to come back.
 */
const ExpenseRefundsComponent: React.FC<{expenseId: string; expenseAmount: number}> = ({expenseId, expenseAmount}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const refunds = useExpenseRefunds(expenseId);
  const remainder = refundableRemainder(expenseAmount, netSpent(refunds, []));

  return (
    <View style={[gs.mb10, gs.gap6]}>
      {refunds.length > 0 ? (
        <PrimaryText size={12} color={colors.secondaryText} accessibilityRole="header">
          {t('refund.section')}
        </PrimaryText>
      ) : null}
      {refunds.map(refund => (
        <TouchableOpacity
          key={refund.id}
          onPress={() => navigate('RefundScreen', {expenseId, refundId: refund.id})}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('refund.rowLabel', {
            title: refund.note || t('refund.section'),
            amount: formatAmount(refund.amount),
            date: formatDisplayDate(refund.date, 'dayMonth'),
          })}
          style={[gs.rowBetweenCenter, gs.px14, gs.py10, gs.rounded12, {backgroundColor: colors.containerColor}]}>
          <View style={[gs.rowCenter, gs.gap8, gs.flex1]}>
            <Icon name="undo-2" size={16} color={colors.accentGreen} />
            <PrimaryText size={13} numberOfLines={1} style={gs.flex1}>
              {[formatDisplayDate(refund.date, 'dayMonth'), refund.note].filter(Boolean).join(' · ')}
            </PrimaryText>
          </View>
          <Amount size={13} weight="semibold" color={colors.accentGreen}>
            {t('refund.back', {amount: formatAmount(refund.amount)})}
          </Amount>
        </TouchableOpacity>
      ))}
      {remainder > 0 ? (
        <PrimaryButton
          onPress={() => navigate('RefundScreen', {expenseId})}
          colors={colors}
          buttonTitle={t('refund.gotMoneyBack')}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      ) : (
        <PrimaryText size={12} color={colors.secondaryText}>
          {t('refund.fullyRefunded')}
        </PrimaryText>
      )}
    </View>
  );
};

export const ExpenseRefunds = memo(ExpenseRefundsComponent);
