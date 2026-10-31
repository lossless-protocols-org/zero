import React, {useCallback} from 'react';
import {ScrollView, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {reportsHeaderLayout} from './headerLayout';
import {useTranslation} from 'react-i18next';
import HeaderContainer from '../../components/molecules/HeaderContainer';
import {MonthCalendarHeatmap} from '../../components/molecules/MonthCalendarHeatmap';
import {CategoryDonut} from '../../components/molecules/CategoryDonut';
import useReports from './useReports';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import EmptyState from '../../components/atoms/EmptyState';
import useFormatAmount from '../../hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import Icon from '../../components/atoms/Icons';
import {MonthNavigator} from '../../components/atoms/MonthNavigator';
import DailyBudgetRow from '../../components/atoms/DailyBudgetRow';
import {gs} from '../../styles/globalStyles';
import {useBudgetScopes} from '../../hooks/useBudgetScopes';
import {computeDailyAllowance} from '../../utils/budgetMath';
import {DataErrorBanner} from '../../components/atoms/DataErrorBanner';
import {useDataError} from '../../hooks/useDataError';
import {logRejection} from '../../utils/errorLog';

/**
 * One-line amounts truncate at very large OS text, and a truncated amount reads
 * as a different number. Capped at 1.6×, then shrunk to fit their tile instead
 * of ending in "…" (M30; the Moto at font scale 2.0 showed "₹53…").
 */
const AMOUNT_FONT_CAP = 1.6;

/** Thunk domains Reports loads from. */
const REPORTS_DOMAINS = ['expense', 'budget', 'user'];

const ReportsScreen = () => {
  // A failed load is not "no insights yet": the banner says so.
  const dataError = useDataError(REPORTS_DOMAINS);
  const {
    colors,
    selectedYear,
    selectedMonthIndex,
    monthLabel: budgetMonthLabel,
    shortMonthLabel,
    yearMonth,
    filteredTransactions,
    dayNames,
    availableYears,
    handleMonthYearSelect,
    shiftMonth,
    canGoForward,
    totalAmountForMonth,
    daysInMonth,
    todayTotal,
    isCurrentMonth,
    currentBudget,
    categoryBudgets,
    currencySymbol,
    currencyCode,
    weekStart,
    handleBudgetSave,
    handleBudgetRemove,
  } = useReports();
  const {t} = useTranslation();
  const {width: windowWidth, fontScale} = useWindowDimensions();
  const formatAmount = useFormatAmount();
  // Adaptive: what is left of the budget, spread over the remaining days.
  const {allowance: dailyBudget} = computeDailyAllowance({
    monthlyBudget: currentBudget?.amount ?? 0,
    spentBeforeToday: totalAmountForMonth - todayTotal,
    dayOfMonth: new Date().getDate(),
    daysInMonth,
    isCurrentMonth,
  });
  const dailyLeft = dailyBudget - todayTotal;
  const budgetExceeded = currentBudget ? totalAmountForMonth > currentBudget.amount : false;

  // Overall first, then every active category: the sheet lets the user pick
  // which one they are budgeting (per-category budgets, three independent asks).
  const budgetScopes = useBudgetScopes(yearMonth);

  const openBudgetSheet = useCallback(
    (initialCategoryId = '') => {
      void SheetManager.show('budget-sheet', {
        payload: {
          currencySymbol,
          currencyCode,
          monthLabel: budgetMonthLabel,
          scopes: budgetScopes,
          initialCategoryId,
          onSave: (amount: number, everyMonth: boolean, categoryId?: string) =>
            logRejection(handleBudgetSave(amount, everyMonth, categoryId)),
          onRemove: (isRecurring: boolean, categoryId?: string) =>
            logRejection(handleBudgetRemove(isRecurring, categoryId)),
        },
      });
    },
    [currencySymbol, currencyCode, budgetMonthLabel, budgetScopes, handleBudgetSave, handleBudgetRemove],
  );

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: selectedMonthIndex,
        selectedYear,
        availableYears,
        onSelect: (monthIdx: number, year: number) => {
          handleMonthYearSelect(monthIdx, year);
        },
      },
    });
  }, [selectedMonthIndex, selectedYear, availableYears, handleMonthYearSelect]);

  const stacked = reportsHeaderLayout(windowWidth, fontScale) === 'stacked';
  const statTiles = (
    <>
      <View style={[gs.flex1, gs.px12, gs.py10, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
          {t('reports.total')}
        </PrimaryText>
        <PrimaryText
          size={14}
          weight="semibold"
          variant="number"
          numberOfLines={1}
          maxFontSizeMultiplier={AMOUNT_FONT_CAP}
          adjustsFontSizeToFit>
          {formatAmount(totalAmountForMonth)}
        </PrimaryText>
      </View>
      <View style={[gs.flex1, gs.px12, gs.py10, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
          {t('reports.avgPerDay')}
        </PrimaryText>
        <PrimaryText
          size={14}
          weight="semibold"
          variant="number"
          numberOfLines={1}
          maxFontSizeMultiplier={AMOUNT_FONT_CAP}
          adjustsFontSizeToFit>
          {formatAmount(totalAmountForMonth / daysInMonth)}
        </PrimaryText>
      </View>
    </>
  );

  return (
    <PrimaryView colors={colors} useBottomPadding={false}>
      <HeaderContainer headerText={t('reports.title')} />
      {/* One row when the tiles can stay readable beside the pill; on a narrow
          phone the pill gets its own row with the full month name. */}
      <View style={stacked ? [gs.gap6, gs.mt10] : [gs.row, gs.wFull, gs.justifyBetween, gs.gap6, gs.mt10]}>
        {/* Centred: the row stretches this card to the two-line tiles' height,
            and top-aligned controls left an empty band under "Oct 2026". */}
        <View
          style={[
            gs.rounded8,
            gs.justifyCenter,
            stacked ? gs.itemsCenter : undefined,
            {backgroundColor: colors.accentGreen},
          ]}>
          <MonthNavigator
            compact
            label={budgetMonthLabel}
            shortLabel={stacked ? undefined : shortMonthLabel}
            canGoForward={canGoForward}
            onShift={shiftMonth}
            onOpenPicker={openMonthPicker}
          />
        </View>
        {stacked ? <View style={[gs.row, gs.gap6]}>{statTiles}</View> : statTiles}
      </View>

      {currentBudget ? (
        <TouchableOpacity
          onPress={() => openBudgetSheet()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('settings.budget')}
          style={[gs.px12, gs.py10, gs.rounded8, gs.mt6, {backgroundColor: colors.secondaryAccent}]}>
          <View style={gs.rowBetweenCenter}>
            <PrimaryText
              size={13}
              weight="semibold"
              variant="number"
              color={budgetExceeded ? colors.accentOrange : colors.primaryText}
              numberOfLines={1}
              maxFontSizeMultiplier={AMOUNT_FONT_CAP}
              adjustsFontSizeToFit>
              {formatAmount(Math.max(currentBudget.amount - totalAmountForMonth, 0))} {t('home.remaining')}
            </PrimaryText>
            <PrimaryText
              size={11}
              variant="number"
              color={colors.secondaryText}
              numberOfLines={1}
              maxFontSizeMultiplier={AMOUNT_FONT_CAP}
              adjustsFontSizeToFit>
              {formatAmount(totalAmountForMonth)} / {formatAmount(currentBudget.amount)}
            </PrimaryText>
          </View>
          <View style={[gs.rounded4, gs.h4, gs.mt8, {backgroundColor: colors.secondaryContainerColor}]}>
            <View
              style={[
                gs.rounded4,
                gs.h4,
                {
                  width: `${Math.min((totalAmountForMonth / currentBudget.amount) * 100, 100)}%`,
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
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => openBudgetSheet()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('reports.setBudget')}
          style={[
            gs.rowCenter,
            gs.gap6,
            gs.px12,
            gs.py10,
            gs.rounded8,
            gs.mt6,
            {backgroundColor: colors.secondaryAccent},
          ]}>
          <Icon name="target" size={14} color={colors.secondaryText} />
          <PrimaryText size={12} color={colors.secondaryText}>
            {t('reports.setBudget')}
          </PrimaryText>
        </TouchableOpacity>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <DataErrorBanner domains={REPORTS_DOMAINS} />
        {filteredTransactions.length === 0 ? (
          dataError ? null : (
            <EmptyState colors={colors} type={'Insights'} style={gs.mt20} />
          )
        ) : (
          <>
            <MonthCalendarHeatmap
              transactions={filteredTransactions}
              year={selectedYear}
              monthIndex={selectedMonthIndex}
              daysInMonth={daysInMonth}
              dayNames={dayNames}
              weekStart={weekStart}
            />
            <View style={[gs.mt20, gs.mb20]}>
              <CategoryDonut
                transactions={filteredTransactions}
                categoryBudgets={categoryBudgets}
                yearMonth={yearMonth}
              />
            </View>
          </>
        )}
      </ScrollView>
    </PrimaryView>
  );
};

export default ReportsScreen;
