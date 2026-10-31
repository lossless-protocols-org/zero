import {RefreshControl, TouchableOpacity, View} from 'react-native';
import {BORROW, LEND} from '../../utils/debtType';
import type {DebtType} from '../../domain/types';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AppHeader from '../../components/atoms/AppHeader';
import {goBack, navigate} from '../../utils/navigationUtils';
import {useRoute} from '@react-navigation/native';
import Icon from '../../components/atoms/Icons';
import useIndividualDebts, {IndividualDebtsScreenRouteProp} from './useIndividualDebts';
import useSwipeTutorial from '../../hooks/useSwipeTutorial';
import SwipeTutorialTooltip from '../../components/atoms/SwipeTutorialTooltip';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import DebtList from '../../components/molecules/DebtList';
import useFormatAmount from '../../hooks/useFormatAmount';
import {gs, hitSlop} from '../../styles/globalStyles';
import {hexToRgba} from '../../utils/colorUtils';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {logRejection} from '../../utils/errorLog';

const IndividualDebtsScreen = () => {
  const route = useRoute<IndividualDebtsScreenRouteProp>();
  const {
    colors,
    refreshing,
    debtorName,
    debtorId,
    debtorTotal,
    onRefresh,
    handleEditDebt,
    handleDeleteDebt,
    handleDeleteDebtor,
    handleMarkAsPaid,
    handleUpdateDebtor,
    sortedBorrowings,
    sortedLendings,
    totalBorrowings,
    totalLendings,
  } = useIndividualDebts(route);
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();

  const [debtsType, setDebtsType] = useState<DebtType>(BORROW);
  const currentDebts = debtsType === BORROW ? sortedBorrowings : sortedLendings;
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'debt',
    itemCount: currentDebts.length,
  });
  const insets = useSafeAreaInsets();

  const netColor = useMemo(() => {
    if (debtorTotal > 0) return colors.accentOrange;
    if (debtorTotal < 0) return colors.accentGreen;
    return colors.primaryText;
  }, [debtorTotal, colors]);

  const netLabel = useMemo(() => {
    if (debtorTotal > 0) return t('debts.youOwe');
    if (debtorTotal < 0) return t('debts.owesYou');
    return t('debts.settled');
  }, [debtorTotal, t]);

  const ListHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <View style={[gs.row, gs.gap8, gs.mb10]}>
          <View
            style={[
              gs.flex1,
              gs.py10,
              gs.px14,
              gs.rounded12,
              {backgroundColor: hexToRgba(colors.accentOrange, 0.078)},
            ]}>
            <PrimaryText size={11} color={colors.accentOrange} style={gs.mb5}>
              {t('debts.borrowed')}
            </PrimaryText>
            <PrimaryText size={18} weight="bold" variant="number" color={colors.accentOrange}>
              {formatAmount(totalBorrowings)}
            </PrimaryText>
          </View>
          <View
            style={[gs.flex1, gs.py10, gs.px14, gs.rounded12, {backgroundColor: hexToRgba(colors.accentGreen, 0.078)}]}>
            <PrimaryText size={11} color={colors.accentGreen} style={gs.mb5}>
              {t('debts.lent')}
            </PrimaryText>
            <PrimaryText size={18} weight="bold" variant="number" color={colors.accentGreen}>
              {formatAmount(totalLendings)}
            </PrimaryText>
          </View>
        </View>

        <View style={[gs.rowBetweenCenter, gs.mb15]}>
          <PrimaryText size={12} color={colors.secondaryText}>
            {netLabel}{' '}
            <PrimaryText size={12} weight="bold" variant="number" color={netColor}>
              {formatAmount(Math.abs(debtorTotal))}
            </PrimaryText>
          </PrimaryText>

          <View style={[gs.row, gs.gap8]}>
            <TouchableOpacity
              onPress={handleMarkAsPaid}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('debts.settled')}>
              <View style={[gs.size32, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
                <Icon name="check-circle" size={16} color={colors.accentBlue} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUpdateDebtor}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}>
              <View style={[gs.size32, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
                <Icon name="pencil" size={16} color={colors.accentGreen} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteDebtor}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}>
              <View style={[gs.size32, gs.roundedFull, gs.center, {backgroundColor: colors.secondaryAccent}]}>
                <Icon name="trash-2" size={16} color={colors.accentOrange} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[gs.row, gs.gap8, gs.mb15]}>
          <TouchableOpacity
            onPress={() => setDebtsType(BORROW)}
            accessibilityRole="tab"
            accessibilityState={{selected: debtsType === BORROW}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {backgroundColor: debtsType === BORROW ? colors.primaryText : colors.secondaryAccent},
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtsType === BORROW ? colors.buttonText : colors.secondaryText}>
              {t('debts.borrowed')}
            </PrimaryText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDebtsType(LEND)}
            accessibilityRole="tab"
            accessibilityState={{selected: debtsType === LEND}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {backgroundColor: debtsType === LEND ? colors.primaryText : colors.secondaryAccent},
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtsType === LEND ? colors.buttonText : colors.secondaryText}>
              {t('debts.lent')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      colors,
      formatAmount,
      debtsType,
      debtorTotal,
      handleDeleteDebtor,
      handleMarkAsPaid,
      handleUpdateDebtor,
      netColor,
      netLabel,
      totalBorrowings,
      totalLendings,
      t,
    ],
  );

  return (
    <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
      <View style={[gs.px16, gs.mb15, gs.mt20]}>
        <AppHeader onPress={goBack} colors={colors} text={debtorName ?? ''} />
      </View>
      <View style={gs.px16}>
        <DataErrorBanner domains={['debt', 'debtor', 'individualDebtor']} />
      </View>
      {shouldShowTutorial && <SwipeTutorialTooltip onDismiss={dismissTutorial} />}
      <DebtList
        colors={colors}
        handleEditDebt={handleEditDebt}
        handleDeleteDebt={debtId => logRejection(handleDeleteDebt(debtId))}
        individualDebts={currentDebts}
        ListHeaderComponent={ListHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        tutorialSwipeRef={tutorialRef}
      />
      <View style={[gs.absolute, gs.end15, gs.zIndex1, {bottom: Math.max(insets.bottom, 15) + 5}]}>
        <TouchableOpacity
          style={[gs.size50, gs.rounded8, gs.center, {backgroundColor: colors.secondaryBackground}]}
          onPress={() => navigate('AddDebtsScreen', {debtorId})}
          hitSlop={hitSlop}
          accessibilityLabel={t('debts.addDebt')}
          accessibilityRole="button">
          <Icon name="plus" size={30} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </PrimaryView>
  );
};

export default IndividualDebtsScreen;
