import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, useMemo, memo} from 'react';
import {useTranslation} from 'react-i18next';
import {Icon} from '../../../ui/atoms/Icons';
import {navigate} from '../../../platform/navigationUtils';
import type {DebtorData as Debtor, DebtData as DebtDocType} from '../../../domain/types';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {FlashList} from '@shopify/flash-list';
import {gs} from '../../../ui/globalStyles';
import {hexToRgba} from '../../../ui/colorUtils';
import {EmptyState} from '../../../ui/atoms/EmptyState';
import {netDebtByDebtor} from '../../../domain/debtType';

interface Debt extends DebtDocType {
  debtor?: {type?: string};
}

interface DebtorListProps {
  colors: ThemeColors;
  debtors: Array<Debtor>;
  allDebts: Array<Debt>;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
}

const DebtorListComponent: React.FC<DebtorListProps> = ({colors, debtors, allDebts, ListHeaderComponent}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const handleDebtor = useCallback((debtorId: string) => {
    navigate('IndividualDebtsScreen', {debtorId});
  }, []);

  // Exact per person (netDebtByDebtor): a float sum read a settled person as "You owe".
  const debtTotalsByDebtor = useMemo(() => netDebtByDebtor(allDebts), [allDebts]);

  const getDebtTotal = useCallback(
    (debtorId: string): number => {
      return debtTotalsByDebtor.get(debtorId) ?? 0;
    },
    [debtTotalsByDebtor],
  );

  const getAmountColor = useCallback(
    (debtorId: string): string => {
      const totalDebt = getDebtTotal(debtorId);
      if (totalDebt < 0) {
        return colors.accentGreen;
      } else if (totalDebt > 0) {
        return colors.accentOrange;
      }
      return colors.primaryText;
    },
    [colors, getDebtTotal],
  );

  const renderDebtorItem = useCallback(
    ({item: debtor}: {item: Debtor}) => {
      const debtorId = String(debtor.id);
      const totalDebt = getDebtTotal(debtorId);
      const amountColor = getAmountColor(debtorId);
      let debtLabel = t('debts.settled');
      if (totalDebt > 0) debtLabel = t('debts.youOwe');
      else if (totalDebt < 0) debtLabel = t('debts.owesYou');

      return (
        <TouchableOpacity
          onPress={() => handleDebtor(debtorId)}
          accessibilityRole="button"
          activeOpacity={0.7}
          style={[gs.mx16, gs.py12, gs.rowCenter, gs.borderBottom05, {borderBottomColor: colors.secondaryAccent}]}>
          <View
            style={[
              gs.size36,
              gs.roundedFull,
              gs.center,
              {backgroundColor: hexToRgba(debtor.color ?? colors.primaryText, 0.094)},
            ]}>
            <Icon dynamicName={debtor.icon || 'user'} size={18} color={debtor.color || colors.primaryText} />
          </View>

          <View style={[gs.flex1, gs.ml12]}>
            <PrimaryText size={14} weight="semibold" numberOfLines={1}>
              {debtor.title}
            </PrimaryText>
            <PrimaryText size={11} color={colors.secondaryText}>
              {debtLabel}
            </PrimaryText>
          </View>

          <View style={[gs.itemsEnd, gs.mr3]}>
            <Amount size={14} weight="bold" color={amountColor}>
              {formatAmount(Math.abs(totalDebt))}
            </Amount>
          </View>

          <Icon name="chevron-right" size={16} color={colors.secondaryText} />
        </TouchableOpacity>
      );
    },
    [colors, formatAmount, getDebtTotal, getAmountColor, handleDebtor, t],
  );

  const ListEmpty = useCallback(
    () => <EmptyState type="Debts" colors={colors} message={t('debts.noOneHereYet')} />,
    [colors, t],
  );

  return (
    <View style={gs.flex1}>
      <FlashList
        data={debtors}
        renderItem={renderDebtorItem}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={gs.pb100}
      />
    </View>
  );
};

export const DebtorList = memo(DebtorListComponent);
