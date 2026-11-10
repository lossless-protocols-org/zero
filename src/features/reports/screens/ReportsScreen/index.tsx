import React, {useCallback} from 'react';
import {ScrollView, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {reportsHeaderLayout} from './headerLayout';
import {useTranslation} from 'react-i18next';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {MonthCalendarHeatmap} from '../../components/MonthCalendarHeatmap';
import {CategoryDonut} from '../../components/CategoryDonut';
import {MoneyInStrip} from '../../components/MoneyInStrip';
import {useReports} from './useReports';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import {Icon} from '../../../../ui/atoms/Icons';
import {MonthNavigator} from '../../../../ui/atoms/MonthNavigator';
import {DailyBudgetRow} from '../../../../ui/atoms/DailyBudgetRow';
import {gs} from '../../../../ui/globalStyles';
import {useBudgetScopes} from '../../../../ui/hooks/useBudgetScopes';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {logRejection} from '../../../../platform/errorLog';

/** Thunk domains Reports loads from. */
const REPORTS_DOMAINS = ['expense', 'budget', 'user'];

export const ReportsScreen = () => {
  // A failed load is not "no insights yet": the banner says so.
  const dataError = useDataError(REPORTS_DOMAINS);
  const {colors, month, totals, budget, chart, currency} = useReports();
  const {t} = useTranslation();
  const {width: windowWidth, fontScale} = useWindowDimensions();
  const formatAmount = useFormatAmount();

  // Overall first, then every active category: the sheet lets the user pick
  // which one they are budgeting (per-category budgets, three independent asks).
  const budgetScopes = useBudgetScopes(month.yearMonth);
  const {save: saveBudget, remove: removeBudget} = budget;
  const {select: selectMonth} = month;

  const openBudgetSheet = useCallback(
    (initialCategoryId = '') => {
      void SheetManager.show('budget-sheet', {
        payload: {
          currencySymbol: currency.symbol,
          currencyCode: currency.code,
          monthLabel: month.label,
          scopes: budgetScopes,
          initialCategoryId,
          onSave: (amount: number, everyMonth: boolean, categoryId?: string) =>
            logRejection(saveBudget(amount, everyMonth, categoryId)),
          onRemove: (isRecurring: boolean, categoryId?: string) => logRejection(removeBudget(isRecurring, categoryId)),
        },
      });
    },
    [currency.symbol, currency.code, month.label, budgetScopes, saveBudget, removeBudget],
  );

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: month.index,
        selectedYear: month.year,
        availableYears: month.availableYears,
        onSelect: (monthIdx: number, year: number) => {
          selectMonth(monthIdx, year);
        },
      },
    });
  }, [month.index, month.year, month.availableYears, selectMonth]);

  const stacked = reportsHeaderLayout(windowWidth, fontScale) === 'stacked';
  const statTiles = (
    <>
      {/* Each tile is one element, "Total, ₹62,676": a figure alone read as a bare
          number (Apple's accessibility audit, iPhone, 2026-11-09). */}
      <View
        accessible
        accessibilityLabel={t('common.fieldValue', {field: t('reports.total'), value: formatAmount(totals.spent)})}
        style={[gs.flex1, gs.px12, gs.py10, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
          {t('reports.total')}
        </PrimaryText>
        <Amount size={14} weight="semibold">
          {formatAmount(totals.spent)}
        </Amount>
      </View>
      <View
        accessible
        accessibilityLabel={t('common.fieldValue', {
          field: t('reports.avgPerDay'),
          value: formatAmount(totals.spent / month.days),
        })}
        style={[gs.flex1, gs.px12, gs.py10, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
        <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
          {t('reports.avgPerDay')}
        </PrimaryText>
        <Amount size={14} weight="semibold">
          {formatAmount(totals.spent / month.days)}
        </Amount>
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
            label={month.label}
            shortLabel={stacked ? undefined : month.shortLabel}
            canGoForward={month.canGoForward}
            onShift={month.shift}
            onOpenPicker={openMonthPicker}
          />
        </View>
        {stacked ? <View style={[gs.row, gs.gap6]}>{statTiles}</View> : statTiles}
      </View>

      {budget.status ? (
        <TouchableOpacity
          onPress={() => openBudgetSheet()}
          activeOpacity={0.7}
          accessibilityRole="button"
          // The card's figures too: as one element, a screen reader reads only its label,
          // which was "Monthly Budget" alone (found on the iPhone, 2026-11-09).
          accessibilityLabel={[
            t('settings.budget'),
            budget.status.exceeded
              ? t('home.overBudget', {amount: formatAmount(budget.status.over)})
              : t('home.amountLeft', {amount: formatAmount(budget.status.left)}),
            t('reports.spentOfBudget', {spent: formatAmount(totals.spent), budget: formatAmount(budget.status.amount)}),
          ].join(', ')}
          style={[gs.px12, gs.py10, gs.rounded8, gs.mt6, {backgroundColor: colors.secondaryAccent}]}>
          <View style={gs.rowBetweenCenter}>
            <Amount
              size={13}
              weight="semibold"
              color={budget.status.exceeded ? colors.accentOrange : colors.primaryText}>
              {budget.status.exceeded
                ? t('home.overBudget', {amount: formatAmount(budget.status.over)})
                : t('home.amountLeft', {amount: formatAmount(budget.status.left)})}
            </Amount>
            <Amount weight="medium" size={11} color={colors.secondaryText}>
              {t('reports.spentOfBudget', {
                spent: formatAmount(totals.spent),
                budget: formatAmount(budget.status.amount),
              })}
            </Amount>
          </View>
          <View style={[gs.rounded4, gs.h4, gs.mt8, {backgroundColor: colors.secondaryContainerColor}]}>
            <View
              style={[
                gs.rounded4,
                gs.h4,
                {
                  width: `${budget.status.fill}%`,
                  backgroundColor: budget.status.exceeded ? colors.accentOrange : colors.accentGreen,
                },
              ]}
            />
          </View>
          <View style={gs.mt6}>
            <DailyBudgetRow
              dailyBudget={budget.status.dailyBudget}
              dailyLeft={budget.status.dailyLeft}
              isCurrentMonth={month.isCurrent}
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

      {/* The gap under the month and budget cards: the money-in strip sat flush against them (owner, Oct 2026). */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pt12}>
        <DataErrorBanner domains={REPORTS_DOMAINS} />
        {/* Money in: only when the month has income or refunds. Donut and heatmap stay spending. */}
        {totals.received > 0 || totals.refunded > 0 ? (
          <MoneyInStrip colors={colors} received={totals.received} spent={totals.spent} refunded={totals.refunded} />
        ) : null}
        {chart.rows.length === 0 ? (
          dataError ? null : (
            <EmptyState colors={colors} type={'Insights'} style={gs.mt20} />
          )
        ) : (
          <>
            <MonthCalendarHeatmap
              transactions={chart.rows}
              year={month.year}
              monthIndex={month.index}
              daysInMonth={month.days}
              dayNames={chart.dayNames}
              weekStart={chart.weekStart}
            />
            <View style={[gs.mt20, gs.mb20]}>
              <CategoryDonut
                transactions={chart.rows}
                categoryBudgets={budget.byCategory}
                yearMonth={month.yearMonth}
              />
            </View>
          </>
        )}
      </ScrollView>
    </PrimaryView>
  );
};
