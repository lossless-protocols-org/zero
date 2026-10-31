import {TouchableOpacity, View} from 'react-native';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import {navigate} from '../../utils/navigationUtils';
import Icon from '../../components/atoms/Icons';
import DebtorList from '../../components/molecules/DebtorList';
import useDebts from './useDebts';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import EmptyState from '../../components/atoms/EmptyState';
import useFormatAmount from '../../hooks/useFormatAmount';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {useDataError} from '../../hooks/useDataError';
import {gs, hitSlop} from '../../styles/globalStyles';

/** Thunk domains the Debts tab loads from. */
const DEBTS_DOMAINS = ['debtor', 'debt', 'user'];

const DebtsScreen = () => {
  const {colors, allDebts, debtorType, setDebtorType, personDebtors, otherAccountsDebtors, totalDebts, debtors} =
    useDebts();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();

  const overallLabel = useMemo(() => {
    if (totalDebts > 0) return t('debts.youOweOthers');
    if (totalDebts < 0) return t('debts.othersOweYou');
    return t('debts.allSettled');
  }, [totalDebts, t]);

  const amountColor = useMemo(() => {
    if (totalDebts > 0) return colors.accentOrange;
    if (totalDebts < 0) return colors.accentGreen;
    return colors.primaryText;
  }, [totalDebts, colors]);

  const ListHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <View style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, gs.center, {backgroundColor: colors.containerColor}]}>
          <PrimaryText size={11} weight="medium" color={colors.secondaryText} style={gs.mb5}>
            {overallLabel}
          </PrimaryText>
          <PrimaryText size={28} weight="bold" variant="number" color={amountColor}>
            {formatAmount(Math.abs(totalDebts))}
          </PrimaryText>
          <View style={[gs.rowCenter, gs.gap6, gs.mt6]}>
            <PrimaryText size={11} color={colors.secondaryText} variant="number">
              {t('debts.personCount', {count: personDebtors.length})}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText}>
              ·
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText} variant="number">
              {t('debts.accountCount', {count: otherAccountsDebtors.length})}
            </PrimaryText>
          </View>
        </View>

        <View style={[gs.row, gs.gap8, gs.mb15]}>
          <TouchableOpacity
            onPress={() => setDebtorType('Person')}
            accessibilityRole="tab"
            accessibilityState={{selected: debtorType === 'Person'}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {
                backgroundColor: debtorType === 'Person' ? colors.primaryText : colors.secondaryAccent,
              },
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtorType === 'Person' ? colors.buttonText : colors.secondaryText}>
              {t('debts.tabPerson')}
            </PrimaryText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDebtorType('Other')}
            accessibilityRole="tab"
            accessibilityState={{selected: debtorType === 'Other'}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {
                backgroundColor: debtorType === 'Other' ? colors.primaryText : colors.secondaryAccent,
              },
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtorType === 'Other' ? colors.buttonText : colors.secondaryText}>
              {t('debts.tabAccounts')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      amountColor,
      colors,
      formatAmount,
      debtorType,
      overallLabel,
      otherAccountsDebtors.length,
      personDebtors.length,
      setDebtorType,
      t,
      totalDebts,
    ],
  );

  // A failed load is not "no debts yet": the banner says so.
  const dataError = useDataError(DEBTS_DOMAINS);

  return (
    <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
      <View style={[gs.px16, gs.mb15]}>
        <HeaderContainer headerText={t('debts.title')} />
      </View>
      <View style={gs.px16}>
        <DataErrorBanner domains={DEBTS_DOMAINS} />
      </View>
      {debtors.length === 0 ? (
        dataError ? null : (
          <View style={gs.px16}>
            <EmptyState colors={colors} type={'Debts'} style={gs.mt30p} />
          </View>
        )
      ) : (
        <DebtorList
          colors={colors}
          debtors={debtorType === 'Person' ? personDebtors : otherAccountsDebtors}
          allDebts={allDebts}
          ListHeaderComponent={ListHeader}
        />
      )}
      <View style={[gs.absolute, gs.bottom15, gs.end15, gs.zIndex1]}>
        <TouchableOpacity
          style={[gs.size50, gs.rounded8, gs.center, {backgroundColor: colors.secondaryBackground}]}
          onPress={() => navigate('AddDebtorScreen')}
          hitSlop={hitSlop}
          accessibilityLabel={t('debts.addDebtor')}
          accessibilityRole="button">
          <Icon name="plus-circle" size={30} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </PrimaryView>
  );
};

export default DebtsScreen;
