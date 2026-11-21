import {ScrollView, View} from 'react-native';
import {AddFab} from '../../../../ui/atoms/AddFab';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {navigate} from '../../../../platform/navigationUtils';
import {useMoney} from './useMoney';
import {ReceivedSection} from '../../components/ReceivedSection';
import {HeldAccounts} from '../../components/HeldAccounts';
import {SegmentedTabs} from '../../../../ui/atoms/SegmentedTabs';
import {useProFeature} from '../../../../ui/hooks/useProFeature';
import {CLASS_ICON, CLASS_LABEL, CLASS_MEANING} from '../../../../ui/accountWords';
import {useDialog} from '../../../../ui/context/DialogContext';
import {SheetManager} from 'react-native-actions-sheet';
import {formatMonthLabel} from '../../../../platform/dateFormat';
import {logRejection} from '../../../../platform/errorLog';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {gs} from '../../../../ui/globalStyles';
import {useIncomeCategories} from '../../../../ui/hooks/useIncomeCategories';
import {useOpenEntry} from '../../../../ui/hooks/useOpenEntry';

/** Thunk domains the Money tab loads from. */
const MONEY_DOMAINS = ['user', 'income'];

type MoneyView = 'accounts' | 'in';
const HELD_CLASSES = ['spend', 'save'] as const;

/**
 * The Money tab: what is held (approved A2; round two item 4). One screen
 * has one time frame, so the tab has two views. For everyone, Money in: what
 * came in during a month and what was kept, exactly the free app's tab. With
 * Pro, a second view beside it and shown first, Accounts: what is in hand
 * now, the accounts to spend from and the money put away, and net worth as a
 * foot line. Without Pro there is no control and no Accounts view (L8). The
 * plus adds what the view lists: an account (it asks which kind), or money in.
 */
export const MoneyScreen = () => {
  const {
    colors,
    month,
    availableYears,
    period,
    previousPeriod,
    incomes,
    incomeCategories,
    received,
    kept,
    canCopyLastMonth,
    copyLastMonth,
  } = useMoney();
  // Without Pro every money-in row is drawn under one category (src/pro/projection.ts).
  const incomeView = useIncomeCategories();
  const {t} = useTranslation();
  // An entry a recurring rule made asks "this one or the rule?" first (Pro, P9).
  const {openIncome, showsRepeat} = useOpenEntry();
  const {showAlert} = useDialog();
  const {yearMonth} = month;
  const accountsOn = useProFeature('accounts');
  const [picked, setPicked] = useState<MoneyView>('accounts');
  const view: MoneyView = accountsOn ? picked : 'in';

  const addAccount = useCallback(() => {
    void SheetManager.show('add-choice-sheet', {
      payload: {
        title: t('money.addToMoney'),
        choices: HELD_CLASSES.map(accountClass => ({
          name: accountClass,
          icon: CLASS_ICON[accountClass],
          label: t(CLASS_LABEL[accountClass]),
          hint: t(CLASS_MEANING[accountClass]),
          onPress: () => navigate('AccountFormScreen', {accountClass}),
        })),
      },
    });
  }, [t]);

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

  return (
    <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
      <View style={[gs.px16, gs.mb15]}>
        <HeaderContainer headerText={t('money.title')} />
      </View>
      <View style={gs.px16}>
        <DataErrorBanner domains={MONEY_DOMAINS} />
      </View>
      {accountsOn ? (
        <View style={[gs.px16, gs.mb15]}>
          <SegmentedTabs<MoneyView>
            tabs={[
              {key: 'accounts', label: t('money.viewAccounts')},
              {key: 'in', label: t('money.received')},
            ]}
            value={view}
            onChange={setPicked}
            colors={colors}
          />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={[gs.px16, gs.pb100]} showsVerticalScrollIndicator={false}>
        {view === 'accounts' ? (
          <HeldAccounts />
        ) : (
          <ReceivedSection
            colors={colors}
            monthLabel={formatMonthLabel(period)}
            canGoForward={month.canGoForward}
            onShiftMonth={month.shiftMonth}
            onOpenMonthPicker={openMonthPicker}
            incomes={incomes}
            categories={incomeCategories}
            oneCategory={incomeView.oneCategory}
            received={received}
            kept={kept}
            copyFromMonth={canCopyLastMonth ? formatMonthLabel(previousPeriod, 'monthYear') : null}
            onCopyLastMonth={handleCopy}
            showRepeat={showsRepeat}
            onOpen={incomeId => {
              const income = incomes.find(row => row.id === incomeId);
              void openIncome({id: incomeId, recurringId: income?.recurringId});
            }}
          />
        )}
      </ScrollView>
      {view === 'accounts' ? (
        <AddFab kind="account" onPress={addAccount} label={t('accounts.add')} colors={colors} />
      ) : (
        <AddFab
          kind="income"
          onPress={() => navigate('AddIncomeScreen', {yearMonth})}
          label={t('money.addIncome')}
          colors={colors}
        />
      )}
    </PrimaryView>
  );
};
