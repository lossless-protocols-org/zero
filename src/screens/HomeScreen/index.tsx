import React, {useCallback, useMemo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from '../../components/atoms/Icons';
import {MonthNavigator} from '../../components/atoms/MonthNavigator';
import {navigate} from '../../utils/navigationUtils';
import TransactionList from '../../components/molecules/TransactionList';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import useHome from './useHome';
import useSwipeTutorial from '../../hooks/useSwipeTutorial';
import SwipeTutorialTooltip from '../../components/atoms/SwipeTutorialTooltip';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import EmptyState from '../../components/atoms/EmptyState';
import useFormatAmount from '../../hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import DailyBudgetRow from '../../components/atoms/DailyBudgetRow';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {useDataError} from '../../hooks/useDataError';
import {gs, hitSlop} from '../../styles/globalStyles';
import {computeDailyAllowance} from '../../utils/budgetMath';
import {formatPercent} from '../../utils/numberUtils';
import {markTimeToInteractive} from '../../utils/startupMarker';

/** Thunk domains Home loads from; a failure in any of them shows the banner. */
const HOME_DOMAINS = ['expense', 'budget', 'user', 'currency', 'category'];

const HomeScreen = () => {
  const {
    colors,
    refreshing,
    userName,
    onRefresh,
    sortedTransactions,
    selectedYear,
    selectedMonthIndex,
    selectedMonthName,
    yearMonth,
    availableYears,
    totalSpent,
    transactionCount,
    todayTotal,
    isCurrentMonth,
    canGoForward,
    daysInMonth,
    currentBudget,
    handleMonthYearSelect,
    shiftMonth,
  } = useHome();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'home',
    itemCount: sortedTransactions.length,
  });

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: selectedMonthIndex,
        selectedYear,
        availableYears,
        onSelect: handleMonthYearSelect,
      },
    });
  }, [selectedMonthIndex, selectedYear, availableYears, handleMonthYearSelect]);

  const budgetPct = currentBudget ? Math.min(Math.round((totalSpent / currentBudget.amount) * 100), 999) : 0;
  const budgetExceeded = currentBudget ? totalSpent > currentBudget.amount : false;
  // Adaptive: what is left of the budget, spread over the remaining days.
  // new Date() deliberately inline — a module-level "today" goes stale at midnight.
  const {allowance: dailyBudget} = computeDailyAllowance({
    monthlyBudget: currentBudget?.amount ?? 0,
    spentBeforeToday: totalSpent - todayTotal,
    dayOfMonth: new Date().getDate(),
    daysInMonth,
    isCurrentMonth,
  });
  const dailyLeft = dailyBudget - todayTotal;

  const listHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <DataErrorBanner domains={HOME_DOMAINS} />
        <TouchableOpacity
          onPress={openMonthPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${selectedMonthName} ${selectedYear}`}
          accessibilityHint={t('sheets.selectMonthYear')}
          style={[gs.px14, gs.py12, gs.rounded12, {backgroundColor: colors.accentGreen}]}>
          <View style={gs.rowBetweenCenter}>
            {/* The whole card opens the picker; the chevrons step one month. */}
            <MonthNavigator
              label={`${selectedMonthName} ${selectedYear}`}
              canGoForward={canGoForward}
              onShift={shiftMonth}
            />
            <PrimaryText size={20} weight="bold" variant="number" color={colors.buttonText}>
              {formatAmount(totalSpent)}
            </PrimaryText>
          </View>
          <View style={[gs.rowCenter, gs.gap8, gs.mt4]}>
            <PrimaryText size={11} color={colors.buttonText} variant="number" style={gs.opacity70}>
              {t('home.transactionCount', {count: transactionCount})}
            </PrimaryText>
            {todayTotal > 0 ? (
              <>
                <PrimaryText size={11} color={colors.buttonText} style={gs.opacity70}>
                  ·
                </PrimaryText>
                <PrimaryText size={11} color={colors.buttonText} variant="number" style={gs.opacity70}>
                  {t('home.today')}: {formatAmount(todayTotal)}
                </PrimaryText>
              </>
            ) : null}
          </View>
        </TouchableOpacity>

        {currentBudget ? (
          <View style={[gs.px14, gs.py10, gs.rounded12, gs.mt6, {backgroundColor: colors.secondaryAccent}]}>
            <View style={gs.rowBetweenCenter}>
              <PrimaryText
                size={12}
                weight="semibold"
                variant="number"
                color={budgetExceeded ? colors.accentOrange : colors.primaryText}>
                {formatAmount(Math.max(currentBudget.amount - totalSpent, 0))} {t('home.remaining')}
              </PrimaryText>
              <PrimaryText size={11} variant="number" color={colors.secondaryText}>
                {formatPercent(budgetPct)}
              </PrimaryText>
            </View>
            <View style={[gs.rounded4, gs.h4, gs.mt8, {backgroundColor: colors.secondaryContainerColor}]}>
              <View
                style={[
                  gs.rounded4,
                  gs.h4,
                  {
                    width: `${Math.min(budgetPct, 100)}%`,
                    backgroundColor: budgetExceeded ? colors.accentOrange : colors.accentGreen,
                  },
                ]}
              />
            </View>
            <View style={gs.mt6}>
              <DailyBudgetRow
                dailyBudget={dailyBudget}
                dailyLeft={dailyLeft}
                isCurrentMonth={isCurrentMonth}
                colors={colors}
                formatAmount={formatAmount}
                t={t}
              />
            </View>
          </View>
        ) : null}
      </View>
    ),
    [
      selectedMonthName,
      selectedYear,
      totalSpent,
      transactionCount,
      todayTotal,
      isCurrentMonth,
      canGoForward,
      currentBudget,
      budgetPct,
      budgetExceeded,
      dailyBudget,
      dailyLeft,
      colors,
      openMonthPicker,
      shiftMonth,
      formatAmount,
      t,
    ],
  );

  // A failed load is not "no transactions yet": the banner above says so.
  const dataError = useDataError(HOME_DOMAINS);
  const listEmpty = useMemo(
    () =>
      dataError ? undefined : (
        <View style={gs.px16}>
          <EmptyState colors={colors} type={'Transactions'} />
        </View>
      ),
    [colors, dataError],
  );

  return (
    <>
      <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
        <View style={[gs.px16, gs.mb15]}>
          <HeaderContainer headerText={t('home.greeting', {name: userName})} />
        </View>
        {shouldShowTutorial && <SwipeTutorialTooltip onDismiss={dismissTutorial} />}
        <TransactionList
          allExpenses={sortedTransactions}
          edgeToEdge
          targetMonth={yearMonth}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={gs.pb100}
          tutorialSwipeRef={tutorialRef}
          onRowsCommitted={markTimeToInteractive}
        />
      </PrimaryView>
      <View style={[gs.absolute, gs.bottom15, gs.end15, gs.zIndex1]}>
        <TouchableOpacity
          style={[gs.size50, gs.rounded8, gs.center, {backgroundColor: colors.secondaryBackground}]}
          onPress={() => navigate('AddTransactionsScreen')}
          hitSlop={hitSlop}
          accessibilityLabel={t('home.addTransaction')}
          accessibilityRole="button">
          <Icon name="plus-circle" size={30} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </>
  );
};

export default HomeScreen;
