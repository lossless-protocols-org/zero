import {View} from 'react-native';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import AppHeader from '../../components/atoms/AppHeader';
import {goBack} from '../../utils/navigationUtils';
import {formatDate as formatDateUtil} from '../../utils/dateUtils';
import TransactionList from '../../components/molecules/TransactionList';
import useEverydayTransaction, {EverydayTransactionRouteProp} from './useEverydayTransaction';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import Icon from '../../components/atoms/Icons';
import useFormatAmount from '../../hooks/useFormatAmount';
import {gs} from '../../styles/globalStyles';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';

const EverydayTransactionScreen = () => {
  const route = useRoute<EverydayTransactionRouteProp>();
  const {formattedDate, colors, expenseDate, allEverydayTransactions, totalAmountForTheDay} =
    useEverydayTransaction(route);
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();

  const listHeader = useMemo(
    () => (
      <View style={[gs.h50, gs.rounded5, gs.rowBetweenCenter, gs.px10, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={13} weight="semibold" style={gs.textCenter}>
          {t('transaction.totalSpent')}
        </PrimaryText>
        <PrimaryText size={13} weight="semibold" style={gs.textCenter}>
          {formatAmount(totalAmountForTheDay)}
        </PrimaryText>
      </View>
    ),
    [colors, formatAmount, totalAmountForTheDay, t],
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
        targetDate={expenseDate}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
      />
    </PrimaryView>
  );
};

export default EverydayTransactionScreen;
