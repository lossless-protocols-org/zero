import React, {useCallback} from 'react';
import {ScrollView, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {reportsHeaderLayout} from './headerLayout';
import {useTranslation} from 'react-i18next';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {MonthCalendarHeatmap} from '../../components/MonthCalendarHeatmap';
import {CategoryDonut} from '../../components/CategoryDonut';
import {MoneyInStrip} from '../../components/MoneyInStrip';
import {useReports} from './useReports';
import {useUnexplained} from '../../hooks/useUnexplained';
import {useMonthPdf} from '../../hooks/useMonthPdf';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import {Icon} from '../../../../ui/atoms/Icons';
import {MonthNavigator} from '../../../../ui/atoms/MonthNavigator';
import {BudgetMeter} from '../../../../ui/molecules/BudgetMeter';
import {gs, hitSlop} from '../../../../ui/globalStyles';
import {ProSlot} from '../../../../ui/atoms/ProSlot';
import {SegmentedTabs} from '../../../../ui/atoms/SegmentedTabs';
import {useProFeature} from '../../../../ui/hooks/useProFeature';
import {navigate} from '../../../../platform/navigationUtils';
import {useBudgetScopes} from '../../../../ui/hooks/useBudgetScopes';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {logRejection} from '../../../../platform/errorLog';

/** The meter's bills link: the list of what is coming up. */
const openComingUp = () => navigate('RecurringScreen');

/** Thunk domains Reports loads from. */
const REPORTS_DOMAINS = ['expense', 'budget', 'user'];

export const ReportsScreen = () => {
  // A failed load is not "no insights yet": the banner says so.
  const dataError = useDataError(REPORTS_DOMAINS);
  const {colors, month, totals, budget, chart, currency} = useReports();
  // Pro (P8): 0 without it, and nothing is read.
  const unexplained = useUnexplained(month.yearMonth);
  // Pro (P12): this month as a PDF, built from the rows on screen at the tap.
  const rangeOn = useProFeature('monthStart');
  const monthPdf = useMonthPdf({
    yearMonth: month.yearMonth,
    period: month.period,
    received: totals.received,
    budget: budget.status?.amount ?? null,
  });
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
        // Pro: any two days is one more choice of period, so it lives with the others.
        ...(rangeOn ? {onCustomRange: () => navigate('RangeReportScreen')} : {}),
      },
    });
  }, [month.index, month.year, month.availableYears, selectMonth, rangeOn]);

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
      <HeaderContainer
        headerText={t('reports.title')}
        action={
          <ProSlot feature="reports">
            <TouchableOpacity
              onPress={() => logRejection(monthPdf.sharePdf())}
              disabled={monthPdf.sharing}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('reports.sharePdf')}
              accessibilityState={{busy: monthPdf.sharing}}
              style={monthPdf.sharing ? gs.opacity50 : undefined}>
              <Icon name="share-2" size={20} color={colors.secondaryText} />
            </TouchableOpacity>
          </ProSlot>
        }
      />
      {/* Pro: Trends is a second view of the same data, so it is a tab here, not a chip that leaves. */}
      <ProSlot feature="trends">
        <View style={gs.mt15}>
          <SegmentedTabs<'month' | 'trends'>
            tabs={[
              {key: 'month', label: t('reports.tabMonth')},
              {key: 'trends', label: t('reports.tabTrends')},
            ]}
            value="month"
            onChange={key => (key === 'trends' ? navigate('TrendsScreen') : undefined)}
            colors={colors}
          />
        </View>
      </ProSlot>
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
        <View style={gs.mt6}>
          {/* The same meter as Home (approved A5; round two item 2): one budget, one look. Its heading edits it. */}
          <TouchableOpacity
            onPress={() => openBudgetSheet()}
            activeOpacity={0.7}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('reports.editBudget', {amount: formatAmount(budget.status.amount)})}
            testID="reports-edit-budget"
            style={[gs.rowBetweenCenter, gs.px3, gs.mb6]}>
            <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
              {t('settings.budget')}
            </PrimaryText>
            <View style={[gs.rowCenter, gs.gap6]}>
              <Amount size={11} weight="medium" color={colors.secondaryText}>
                {formatAmount(budget.status.amount)}
              </Amount>
              <Icon name="pencil" size={12} color={colors.secondaryText} />
            </View>
          </TouchableOpacity>
          <BudgetMeter status={budget.status} isCurrentMonth={month.isCurrent} onBillsPress={openComingUp} />
        </View>
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
        {/* Pro (P11, P12): trends, a custom range and this month as a PDF. Nothing is drawn without Pro. */}
        {/* Money in: only when the month has income or refunds. Donut and heatmap stay spending. */}
        {totals.received > 0 || totals.refunded > 0 || unexplained !== 0 ? (
          <MoneyInStrip
            colors={colors}
            received={totals.received}
            spent={totals.spent}
            refunded={totals.refunded}
            unexplained={unexplained}
          />
        ) : null}
        {chart.rows.length === 0 ? (
          dataError ? null : (
            <EmptyState colors={colors} type={'Insights'} style={gs.mt20} />
          )
        ) : (
          <>
            <MonthCalendarHeatmap
              transactions={chart.rows}
              period={month.period}
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
