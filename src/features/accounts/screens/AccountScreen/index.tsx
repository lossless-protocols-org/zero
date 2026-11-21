import React, {useCallback, useMemo} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Amount} from '../../../../ui/atoms/Amount';
import {MonthNavigator} from '../../../../ui/atoms/MonthNavigator';
import {Icon} from '../../../../ui/atoms/Icons';
import {StatusChip} from '../../../../ui/atoms/StatusChip';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {displayAccountName} from '../../../../i18n/displayNames';
import {formatDisplayDate, formatMonthLabel} from '../../../../platform/dateFormat';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import type {HomeStackParamList} from '../../../../navigation/types';
import type {AccountEntry} from '../../../../data/services/netWorthService';
import {useAccountDetail} from '../../hooks/useAccountDetail';
import {AccountEntryRow} from '../../components/AccountEntryRow';
import {CHECK_LABEL} from '../../accountCopy';
import {CLASS_LABEL, formatBalance, kindLabelOf} from '../../../../ui/accountWords';
import {classOf, isOwedType} from '../../../../domain/accounts';
import {todayIsoDay, toDayKey} from '../../../../domain/dates';
import {gs} from '../../../../ui/globalStyles';

/** A balance set by hand this many days ago or more is worth checking again. */
const STALE_AFTER_DAYS = 45;

const daysSince = (day: string): number =>
  Math.round((Date.parse(`${todayIsoDay()}T00:00:00Z`) - Date.parse(`${toDayKey(day)}T00:00:00Z`)) / 86_400_000);

/**
 * One account (UX revamp v2). What it shows first depends on what it is: a
 * card says what is owed and offers to pay its bill; an investment says what
 * it is worth and offers to update that; anything else shows its balance and
 * moves money. Entries are grouped by day, and money moved between accounts
 * never looks like spending. Managing the account sits at the bottom.
 */
export const AccountScreen = () => {
  const {accountId} = useRoute<RouteProp<HomeStackParamList, 'AccountScreen'>>().params;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {account, balance, entries, missing, month, period, makeDefault, toggleArchived, removeCheckpoint} =
    useAccountDetail(accountId);

  const openEntry = useCallback(
    (entry: AccountEntry) => {
      switch (entry.kind) {
        case 'expense':
          navigate('UpdateTransactionScreen', {expenseId: entry.id});
          return;
        case 'refund':
          if (entry.expenseId) {
            navigate('RefundScreen', {expenseId: entry.expenseId, refundId: entry.id});
          }
          return;
        case 'income':
          navigate('UpdateIncomeScreen', {incomeId: entry.id});
          return;
        case 'transferIn':
        case 'transferOut':
          navigate('TransferScreen', {transferId: entry.id});
          return;
        case 'lent':
        case 'borrowed':
          navigate('UpdateDebtScreen', {debtId: entry.id});
          return;
        case 'checkpoint':
          logRejection(removeCheckpoint(entry.id));
      }
    },
    [removeCheckpoint],
  );

  // Newest first, as the service gives them; one group per day.
  const days = useMemo(() => {
    const groups: Array<{day: string; entries: AccountEntry[]}> = [];
    for (const entry of entries) {
      const day = toDayKey(entry.date);
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.entries.push(entry);
      } else {
        groups.push({day, entries: [entry]});
      }
    }
    return groups;
  }, [entries]);

  if (missing) {
    return (
      <PrimaryView colors={colors}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text="" />
        </View>
        <PrimaryText size={14} color={colors.secondaryText}>
          {t('common.recordMissing')}
        </PrimaryText>
      </PrimaryView>
    );
  }
  if (!account || !balance) {
    return <PrimaryView colors={colors} />;
  }
  const group = classOf(account.type);
  const owed = isOwedType(account.type) && balance.balance < 0;
  const stale = balance.anchorDate !== null && daysSince(balance.anchorDate) >= STALE_AFTER_DAYS;
  const check = () => navigate('ReconcileScreen', {accountId});
  const move = () => navigate('TransferScreen', {fromAccountId: accountId});
  // A card's bill is what is owed; a loan is paid an EMI at a time, so its amount is left to type.
  const payBill = () =>
    navigate(
      'TransferScreen',
      group === 'card' ? {toAccountId: accountId, amount: 0 - balance.balance} : {toAccountId: accountId},
    );
  // The one thing most often done here, by what the account is.
  const primary = owed
    ? {title: t(group === 'card' ? 'accounts.payBill' : 'accounts.payLoan'), onPress: payBill}
    : group === 'save'
      ? {title: t(CHECK_LABEL.save), onPress: check}
      : {title: t('accounts.transfer'), onPress: move};
  const secondary =
    group === 'save' ? {title: t('accounts.transfer'), onPress: move} : {title: t(CHECK_LABEL[group]), onPress: check};
  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader
          onPress={goBack}
          colors={colors}
          text={displayAccountName(account.name, t)}
          subtitle={[t(CLASS_LABEL[group]), kindLabelOf(account, t)].filter(Boolean).join(' · ')}
          rightAction={
            <TouchableOpacity
              onPress={() => navigate('AccountFormScreen', {accountId})}
              accessibilityRole="button"
              accessibilityLabel={t('accounts.editTitle')}
              style={gs.minTouch}>
              <Icon name="pencil" size={20} color={colors.primaryText} />
            </TouchableOpacity>
          }
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
          <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
            {owed ? t('accounts.lineYouOwe') : group === 'save' ? t('accounts.worth') : t('accounts.balance')}
          </PrimaryText>
          <Amount size={28} weight="bold">
            {owed ? formatAmount(-balance.balance) : formatBalance(formatAmount, balance.balance)}
          </Amount>
          <View style={[gs.row, gs.mt6]}>
            {stale && balance.anchorDate ? (
              <StatusChip
                tone="attention"
                label={t('accounts.notCheckedSince', {date: formatDisplayDate(balance.anchorDate, 'date')})}
              />
            ) : (
              <PrimaryText size={11} color={colors.secondaryText}>
                {balance.anchorDate
                  ? t('accounts.reconciledOn', {date: formatDisplayDate(balance.anchorDate, 'date')})
                  : t('accounts.fromOpening')}
              </PrimaryText>
            )}
          </View>
          <View style={[gs.row, gs.gap10, gs.mt10]}>
            {account.active || primary.onPress === check ? (
              <View style={gs.flex1}>
                <PrimaryButton onPress={primary.onPress} colors={colors} buttonTitle={primary.title} size="sm" />
              </View>
            ) : null}
            {account.active || secondary.onPress === check ? (
              <View style={gs.flex1}>
                <PrimaryButton
                  onPress={secondary.onPress}
                  colors={colors}
                  buttonTitle={secondary.title}
                  variant="outline"
                  size="sm"
                />
              </View>
            ) : null}
          </View>
        </View>

        {group === 'card' ? (
          <PrimaryText size={11} color={colors.secondaryText} style={[gs.mb15, gs.px3]}>
            {t('accounts.cardBillNote')}
          </PrimaryText>
        ) : null}

        <View style={[gs.rowBetweenCenter, gs.mb10]}>
          <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
            {t('accounts.monthEntries')}
          </PrimaryText>
          <MonthNavigator
            label={formatMonthLabel(period)}
            canGoForward={month.canGoForward}
            onShift={month.shiftMonth}
            color={colors.primaryText}
            compact
          />
        </View>
        {entries.length === 0 ? (
          <PrimaryText size={13} color={colors.secondaryText} style={gs.mb15}>
            {t('accounts.noEntries')}
          </PrimaryText>
        ) : (
          days.map(({day, entries: ofDay}) => (
            <ListSection key={day} title={formatDisplayDate(day, 'dayMonth')} style={gs.mb12}>
              {ofDay.map(entry => (
                <AccountEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} onPress={() => openEntry(entry)} />
              ))}
            </ListSection>
          ))
        )}

        <ListSection title={t('accounts.manage')} style={[gs.mt10, gs.mb20]}>
          <ListRow
            icon="pencil"
            title={t('accounts.editTitle')}
            onPress={() => navigate('AccountFormScreen', {accountId})}
          />
          {account.active && !account.isDefault ? (
            <ListRow
              icon="star"
              title={t('accounts.makeDefault')}
              subtitle={t('accounts.makeDefaultSubtitle')}
              onPress={() => logRejection(makeDefault())}
              chevron={false}
            />
          ) : null}
          <ListRow
            icon="archive"
            title={account.active ? t('accounts.archive') : t('accounts.unarchive')}
            onPress={() => logRejection(toggleArchived())}
            chevron={false}
          />
        </ListSection>
      </ScrollView>
    </PrimaryView>
  );
};
