import React, {useCallback, useMemo} from 'react';
import {AddFab} from '../../../../ui/atoms/AddFab';
import {TouchableOpacity, View, type AccessibilityActionEvent} from 'react-native';
import {useTranslation} from 'react-i18next';
import {MonthNavigator} from '../../../../ui/atoms/MonthNavigator';
import {navigate} from '../../../../platform/navigationUtils';
import {TransactionList} from '../../components/TransactionList';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {useHome} from './useHome';
import {useSwipeTutorial} from '../../../../ui/hooks/useSwipeTutorial';
import {SwipeTutorialTooltip} from '../../../../ui/atoms/SwipeTutorialTooltip';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {SheetManager} from 'react-native-actions-sheet';
import {DailyBudgetRow} from '../../../../ui/atoms/DailyBudgetRow';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {gs} from '../../../../ui/globalStyles';
import {keptOf} from '../../../../domain/periodMath';
import {formatPercent} from '../../../../platform/numberFormat';
import {markTimeToInteractive} from '../../../../platform/startupMarker';

/** Thunk domains Home loads from; a failure in any of them shows the banner. */
const HOME_DOMAINS = ['expense', 'budget', 'user', 'currency', 'category'];

export const HomeScreen = () => {
  const {colors, userName, refresh, month, totals, budget, list} = useHome();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const {shouldShowTutorial, tutorialRef, dismissTutorial} = useSwipeTutorial({
    screen: 'home',
    itemCount: list.transactions.length,
  });

  const openMonthPicker = useCallback(() => {
    void SheetManager.show('month-year-picker-sheet', {
      payload: {
        selectedMonth: month.index,
        selectedYear: month.year,
        availableYears: month.availableYears,
        onSelect: month.select,
      },
    });
  }, [month.index, month.year, month.availableYears, month.select]);

  // The card's facts as a screen reader lists them: month, spent, entries, today, money in.
  const cardLabel = [
    month.label,
    formatAmount(totals.spent),
    t('home.transactionCount', {count: totals.count}),
    totals.today > 0 ? t('home.todayAmount', {amount: formatAmount(totals.today)}) : '',
    totals.received > 0
      ? keptOf(totals.received, totals.spent) >= 0
        ? t('money.receivedLine', {
            received: formatAmount(totals.received),
            kept: formatAmount(keptOf(totals.received, totals.spent)),
          })
        : t('money.overReceivedLine', {
            received: formatAmount(totals.received),
            over: formatAmount(keptOf(totals.spent, totals.received)),
          })
      : '',
  ]
    .filter(Boolean)
    .join(', ');
  const cardActions = useMemo(
    () => [
      {name: 'previous', label: t('home.previousMonth')},
      ...(month.canGoForward ? [{name: 'next', label: t('home.nextMonth')}] : []),
    ],
    [month.canGoForward, t],
  );
  const onCardAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'previous') {
        month.shift(-1);
      } else if (event.nativeEvent.actionName === 'next' && month.canGoForward) {
        month.shift(1);
      }
    },
    [month],
  );

  const listHeader = useMemo(
    () => (
      <View style={gs.mx16}>
        <DataErrorBanner domains={HOME_DOMAINS} />
        <TouchableOpacity
          onPress={openMonthPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          // One element for a screen reader, so it says the whole card: VoiceOver and
          // TalkBack read only the label of an accessible card, never the texts and
          // chevrons inside it. It was "November 2026" alone: no figure, and no way to
          // step the month (found on the iPhone, 2026-11-09). The chevrons are its actions.
          accessibilityLabel={cardLabel}
          accessibilityHint={t('sheets.selectMonthYear')}
          accessibilityActions={cardActions}
          onAccessibilityAction={onCardAction}
          style={[gs.px14, gs.py12, gs.rounded12, {backgroundColor: colors.accentGreen}]}>
          <View style={gs.rowBetweenCenter}>
            {/* The whole card opens the picker; the chevrons step one month. */}
            <MonthNavigator label={month.label} canGoForward={month.canGoForward} onShift={month.shift} />
            <Amount size={20} weight="bold" color={colors.buttonText}>
              {formatAmount(totals.spent)}
            </Amount>
          </View>
          <View style={[gs.rowCenter, gs.gap8, gs.mt4]}>
            <PrimaryText size={11} color={colors.buttonText} variant="number" style={gs.opacity70}>
              {t('home.transactionCount', {count: totals.count})}
            </PrimaryText>
            {totals.today > 0 ? (
              <>
                <PrimaryText size={11} color={colors.buttonText} style={gs.opacity70}>
                  ·
                </PrimaryText>
                <Amount size={11} weight="medium" color={colors.buttonText} style={gs.opacity70}>
                  {t('home.todayAmount', {amount: formatAmount(totals.today)})}
                </Amount>
              </>
            ) : null}
          </View>
          {/* Only once the month has money in: spending stays the headline (R4, never a balance). */}
          {totals.received > 0 ? (
            <Amount weight="medium" size={11} color={colors.buttonText} style={[gs.mt4, gs.opacity70]}>
              {keptOf(totals.received, totals.spent) >= 0
                ? t('money.receivedLine', {
                    received: formatAmount(totals.received),
                    kept: formatAmount(keptOf(totals.received, totals.spent)),
                  })
                : t('money.overReceivedLine', {
                    received: formatAmount(totals.received),
                    over: formatAmount(keptOf(totals.spent, totals.received)),
                  })}
            </Amount>
          ) : null}
        </TouchableOpacity>

        {budget ? (
          <View style={[gs.px14, gs.py10, gs.rounded12, gs.mt6, {backgroundColor: colors.secondaryAccent}]}>
            <View style={gs.rowBetweenCenter}>
              <Amount size={12} weight="semibold" color={budget.exceeded ? colors.accentOrange : colors.primaryText}>
                {budget.exceeded
                  ? t('home.overBudget', {amount: formatAmount(budget.over)})
                  : t('home.amountLeft', {amount: formatAmount(budget.left)})}
              </Amount>
              <PrimaryText size={11} variant="number" color={colors.secondaryText}>
                {formatPercent(budget.percent)}
              </PrimaryText>
            </View>
            <View style={[gs.rounded4, gs.h4, gs.mt8, {backgroundColor: colors.secondaryContainerColor}]}>
              <View
                style={[
                  gs.rounded4,
                  gs.h4,
                  {
                    width: `${budget.fill}%`,
                    backgroundColor: budget.exceeded ? colors.accentOrange : colors.accentGreen,
                  },
                ]}
              />
            </View>
            <View style={gs.mt6}>
              <DailyBudgetRow
                dailyBudget={budget.dailyBudget}
                dailyLeft={budget.dailyLeft}
                isCurrentMonth={month.isCurrent}
              />
            </View>
          </View>
        ) : null}
      </View>
    ),
    [month, totals, budget, colors, openMonthPicker, formatAmount, t, cardLabel, cardActions, onCardAction],
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
          allExpenses={list.transactions}
          refunds={list.refunds}
          refundedByExpense={list.refundedByExpense}
          edgeToEdge
          targetMonth={month.yearMonth}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          refreshing={refresh.refreshing}
          onRefresh={refresh.onRefresh}
          contentContainerStyle={gs.pb100}
          tutorialSwipeRef={tutorialRef}
          onRowsCommitted={markTimeToInteractive}
          sortable
        />
      </PrimaryView>
      <AddFab
        kind="expense"
        onPress={() => navigate('AddTransactionsScreen')}
        label={t('home.addTransaction')}
        colors={colors}
      />
    </>
  );
};
