import {View} from 'react-native';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {goBack} from '../../../../platform/navigationUtils';
import {formatDate as formatDateUtil} from '../../../../domain/dates';
import {TransactionList} from '../../components/TransactionList';
import {useEverydayTransaction, EverydayTransactionRouteProp} from './useEverydayTransaction';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Icon} from '../../../../ui/atoms/Icons';
import {useFormatSpend} from '../../../../ui/hooks/useFormatSpend';
import {gs} from '../../../../ui/globalStyles';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';

export const EverydayTransactionScreen = () => {
  const route = useRoute<EverydayTransactionRouteProp>();
  const {
    refunds,
    refundedByExpense,
    formattedDate,
    colors,
    expenseDate,
    allEverydayTransactions,
    totalAmountForTheDay,
  } = useEverydayTransaction(route);
  const {t} = useTranslation();
  // Net of refunds; a refund-only day or category reads as money back.
  const formatSpend = useFormatSpend();

  const listHeader = useMemo(
    () => (
      <View style={[gs.h50, gs.rounded5, gs.rowBetweenCenter, gs.px10, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={13} weight="semibold" style={gs.textCenter}>
          {t('transaction.totalSpent')}
        </PrimaryText>
        <PrimaryText size={13} weight="semibold" style={gs.textCenter}>
          {formatSpend(totalAmountForTheDay).text}
        </PrimaryText>
      </View>
    ),
    [colors, formatSpend, totalAmountForTheDay, t],
  );

  const listEmpty = useMemo(
    () => (
      <View style={[gs.center, gs.mt30p]}>
        <View style={[gs.size50, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name="receipt" size={22} color={colors.secondaryText} />
        </View>
        <PrimaryText size={13} color={colors.secondaryText} style={gs.mt10}>
          {t('transaction.noTransactionsOnDate', {date: formatDateUtil(expenseDate, 'Do MMM YY')})}
        </PrimaryText>
      </View>
    ),
    [colors, expenseDate, t],
  );

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={goBack} colors={colors} text={formattedDate} />
      </View>
      <DataErrorBanner domains={['expense']} />
      <TransactionList
        allExpenses={allEverydayTransactions}
        refunds={refunds}
        refundedByExpense={refundedByExpense}
        targetDate={expenseDate}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        sortable
      />
    </PrimaryView>
  );
};
