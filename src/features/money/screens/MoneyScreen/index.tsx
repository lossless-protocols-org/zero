import {ScrollView, TouchableOpacity, View} from 'react-native';
import {AddFab} from '../../../../ui/atoms/AddFab';
import {SegmentedTabs} from '../../../../ui/atoms/SegmentedTabs';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {navigate} from '../../../../platform/navigationUtils';
import {DebtorList} from '../../components/DebtorList';
import {useMoney} from './useMoney';
import {ReceivedSection} from '../../components/ReceivedSection';
import {useDialog} from '../../../../ui/context/DialogContext';
import {SheetManager} from 'react-native-actions-sheet';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {logRejection} from '../../../../platform/errorLog';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {gs} from '../../../../ui/globalStyles';

/** Thunk domains the Money tab loads from. */
const MONEY_DOMAINS = ['debtor', 'debt', 'user', 'income'];

type MoneyPart = 'received' | 'debts';

/**
 * The Money tab (2.8; was Debts): the Money book of ZERO_SYSTEM_DESIGN.md §2 —
 * what came in and who owes whom — kept apart from spending, which stays on
 * Home. Two tabs, one part at a time (owner: debts used to sit under a long
 * scroll of money in). The add button adds what the open tab shows. 3.0 adds
 * accounts and the net-worth header here.
 */
export const MoneyScreen = () => {
  const {
    colors,
    month,
    availableYears,
    previousYearMonth,
    incomes,
    incomeCategories,
    received,
    kept,
    canCopyLastMonth,
    copyLastMonth,
    allDebts,
    debtorType,
    setDebtorType,
    personDebtors,
    otherAccountsDebtors,
    totalDebts,
    debtors,
  } = useMoney();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const {showAlert} = useDialog();
  const {yearMonth} = month;
  const [part, setPart] = useState<MoneyPart>('received');

  const handleCopy = useCallback(() => {
    logRejection(
      copyLastMonth().then(async ok => {
        if (!ok) {
          await showAlert({type: 'error', message: t('money.copyFailed')});
        }
      }),
    );
  }, [copyLastMonth, showAlert, t]);

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: month.selectedMonthIndex,
        selectedYear: month.selectedYear,
        availableYears,
        onSelect: month.handleMonthYearSelect,
      },
    });
  }, [month.selectedMonthIndex, month.selectedYear, month.handleMonthYearSelect, availableYears]);

  // A failed load is not "no debts yet": the banner says so.
  const dataError = useDataError(MONEY_DOMAINS);

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

  const DebtsHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <View style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, gs.center, {backgroundColor: colors.containerColor}]}>
          <PrimaryText size={11} weight="medium" color={colors.secondaryText} style={gs.mb5}>
            {overallLabel}
          </PrimaryText>
          <Amount size={28} weight="bold" color={amountColor}>
            {formatAmount(Math.abs(totalDebts))}
          </Amount>
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
            onPress={() => setDebtorType('people')}
            accessibilityRole="tab"
            accessibilityState={{selected: debtorType === 'people'}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {
                backgroundColor: debtorType === 'people' ? colors.primaryText : colors.secondaryAccent,
              },
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtorType === 'people' ? colors.buttonText : colors.secondaryText}>
              {t('debts.tabPerson')}
            </PrimaryText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDebtorType('accounts')}
            accessibilityRole="tab"
            accessibilityState={{selected: debtorType === 'accounts'}}
            activeOpacity={0.7}
            style={[
              gs.py8,
              gs.minTouch,
              gs.px14,
              gs.rounded12,
              {
                backgroundColor: debtorType === 'accounts' ? colors.primaryText : colors.secondaryAccent,
              },
            ]}>
            <PrimaryText
              size={13}
              weight="semibold"
              color={debtorType === 'accounts' ? colors.buttonText : colors.secondaryText}>
              {t('debts.tabAccounts')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
        {/* No debtors yet: the debts part shows its empty state; Received above still works. */}
        {debtors.length === 0 && !dataError ? <EmptyState colors={colors} type={'Debts'} /> : null}
      </View>
    ),
    [
      debtors.length,
      dataError,
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

  return (
    <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
      <View style={[gs.px16, gs.mb15]}>
        <HeaderContainer headerText={t('money.title')} />
      </View>
      <View style={gs.px16}>
        <DataErrorBanner domains={MONEY_DOMAINS} />
      </View>
      <View style={[gs.px16, gs.mb15]}>
        <SegmentedTabs<MoneyPart>
          tabs={[
            {key: 'received', label: t('money.receivedSection')},
            {key: 'debts', label: t('money.debtsSection'), count: debtors.length},
          ]}
          value={part}
          onChange={setPart}
          colors={colors}
        />
      </View>
      {part === 'received' ? (
        <ScrollView contentContainerStyle={[gs.px16, gs.pb100]} showsVerticalScrollIndicator={false}>
          <ReceivedSection
            colors={colors}
            monthLabel={formatDisplayDate(`${month.yearMonth}-01`, 'monthYearLong')}
            canGoForward={month.canGoForward}
            onShiftMonth={month.shiftMonth}
            onOpenMonthPicker={openMonthPicker}
            incomes={incomes}
            categories={incomeCategories}
            received={received}
            kept={kept}
            copyFromMonth={canCopyLastMonth ? formatDisplayDate(`${previousYearMonth}-01`, 'monthYear') : null}
            onCopyLastMonth={handleCopy}
            onOpen={incomeId => navigate('UpdateIncomeScreen', {incomeId})}
          />
        </ScrollView>
      ) : (
        <DebtorList
          colors={colors}
          debtors={debtorType === 'people' ? personDebtors : otherAccountsDebtors}
          allDebts={allDebts}
          ListHeaderComponent={DebtsHeader}
        />
      )}
      <AddFab
        kind={part === 'received' ? 'income' : 'person'}
        onPress={() => (part === 'received' ? navigate('AddIncomeScreen', {yearMonth}) : navigate('AddDebtorScreen'))}
        label={part === 'received' ? t('money.addIncome') : t('debts.addDebtor')}
        colors={colors}
      />
    </PrimaryView>
  );
};
