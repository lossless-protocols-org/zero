import {View} from 'react-native';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {goBack} from '../../../../platform/navigationUtils';
import {TransactionList} from '../../components/TransactionList';
import {useCategoryTransaction, CategoryTransactionRouteProp} from './useCategoryTransaction';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {Icon} from '../../../../ui/atoms/Icons';
import {useFormatSpend} from '../../../../ui/hooks/useFormatSpend';
import {gs} from '../../../../ui/globalStyles';
import {hexToRgba} from '../../../../ui/colorUtils';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';

export const CategoryTransactionScreen = () => {
  const route = useRoute<CategoryTransactionRouteProp>();
  const {
    refunds,
    refundedByExpense,
    colors,
    transactions,
    totalAmount,
    categoryName,
    categoryColor,
    categoryIcon,
    monthLabel,
    yearMonth,
  } = useCategoryTransaction(route);
  const {t} = useTranslation();
  // Net of refunds; a refund-only day or category reads as money back.
  const formatSpend = useFormatSpend();

  const listHeader = useMemo(
    () => (
      <View style={[gs.rounded12, gs.py12, gs.px14, gs.mb10, {backgroundColor: colors.secondaryAccent}]}>
        <View style={[gs.rowCenter, gs.gap10]}>
          <View style={[gs.size36, gs.roundedFull, gs.center, {backgroundColor: hexToRgba(categoryColor, 0.125)}]}>
            <Icon dynamicName={categoryIcon || 'shapes'} size={18} color={categoryColor} />
          </View>
          <View style={gs.flex1}>
            <PrimaryText size={11} color={colors.secondaryText}>
              {monthLabel}
            </PrimaryText>
            <Amount size={15} weight="semibold">
              {formatSpend(totalAmount).text}
            </Amount>
          </View>
          <View style={[gs.px10, gs.py3, gs.rounded8, {backgroundColor: hexToRgba(categoryColor, 0.125)}]}>
            <PrimaryText size={12} weight="semibold" variant="number" color={categoryColor}>
              {t('transaction.txnCount', {count: transactions.length})}
            </PrimaryText>
          </View>
        </View>
      </View>
    ),
    [colors, formatSpend, totalAmount, categoryColor, categoryIcon, monthLabel, transactions.length, t],
  );

  const listEmpty = useMemo(
    () => (
      <View style={[gs.center, gs.mt30p]}>
        <View style={[gs.size50, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name="receipt" size={22} color={colors.secondaryText} />
        </View>
        <PrimaryText size={13} color={colors.secondaryText} style={gs.mt10}>
          {t('transaction.noTransactionsInCategory', {category: categoryName})}
        </PrimaryText>
      </View>
    ),
    [colors, categoryName, t],
  );

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={goBack} colors={colors} text={categoryName} />
      </View>
      <DataErrorBanner domains={['expense']} />
      <TransactionList
        allExpenses={transactions}
        refunds={refunds}
        refundedByExpense={refundedByExpense}
        targetMonth={yearMonth}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
      />
    </PrimaryView>
  );
};
