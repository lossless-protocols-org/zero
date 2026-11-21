import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import {ProSlot} from '../../../ui/atoms/ProSlot';
import {StatusChip} from '../../../ui/atoms/StatusChip';
import {ListRow} from '../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {useCommitments} from '../../../ui/hooks/useCommitments';
import {useRecurringSummary} from '../../../ui/hooks/useRecurringSummary';
import {formatBalance} from '../../../ui/accountWords';
import {lessOf, oldestCheckOf, toSpendOf} from '../../../domain/commitments';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {navigate} from '../../../platform/navigationUtils';
import type {AccountBalance} from '../../../data/services/netWorthService';
import {gs} from '../../../ui/globalStyles';

/**
 * The one line under "In hand" (Pro, recurring on): what is still due before
 * the next month starts, what comes next and what that leaves, and the way
 * into Coming up. With nothing due it is still that way in. The word "free"
 * is the budget's alone (round two, item 7): here the money left is "after".
 */
const DueLine: React.FC<{inHand: number}> = ({inHand}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {still, nextStart} = useCommitments(true);
  const {count, next, waiting} = useRecurringSummary();
  const date = formatDisplayDate(nextStart, 'dayMonth');
  const hasBills = still.items.length > 0;
  const nextLine =
    next === null
      ? t('recurring.cardLine', {count})
      : t('recurring.nextLine', {when: formatDisplayDate(next.day, 'dayMonth'), title: next.title});
  const after = hasBills ? t('money.afterDue', {amount: formatBalance(formatAmount, lessOf(inHand, still.total))}) : '';
  const needs = waiting > 0 ? t('recurring.needsYou', {count: waiting}) : '';
  const title = hasBills ? t('money.billsBefore', {date}) : t('recurring.title');
  const subtitle = [nextLine, after].filter(Boolean).join(' · ');
  const amount = hasBills ? formatAmount(still.total) : undefined;
  return (
    <>
      <View style={[gs.mx16, styles.divider, {backgroundColor: colors.secondaryAccent}]} />
      <ListRow
        icon="repeat"
        title={title}
        subtitle={subtitle}
        amount={amount}
        amountColor={colors.accentRed}
        onPress={() => navigate('RecurringScreen')}
        chevron
        accessibilityLabel={[title, amount, subtitle, needs].filter(Boolean).join(', ')}
        trailing={waiting > 0 ? <StatusChip label={needs} tone="attention" /> : undefined}
        testID="held-due-line"
      />
    </>
  );
};

/** What recurring entries do not count because their amount varies: said, never guessed. Pro, recurring on. */
const VariesNote: React.FC = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {still} = useCommitments(true);
  return still.varies.length > 0 ? (
    <PrimaryText size={11} color={colors.secondaryText} style={gs.px3}>
      {t('money.plusVaries', {titles: still.varies.join(', ')})}
    </PrimaryText>
  ) : null;
};

/**
 * The top of the Money tab's Accounts view (Pro; approved A2, round two item
 * 4): the tab's one number, what is in hand, with the one thing done to it
 * (move it) beside it, and under it one line for what is due. Card and loan
 * debt is not taken off here: it is owed, and lives on the Debts tab. The
 * sum is only as true as the balances, so the card says when they were last
 * checked. Mounted only with accounts on.
 */
export const HeldCard: React.FC<{accounts: readonly AccountBalance[]}> = ({accounts}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const inHand = toSpendOf(accounts);
  const figure = formatBalance(formatAmount, inHand);
  const checked = oldestCheckOf(accounts);
  return (
    <View style={gs.mb15}>
      <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
        <View style={[gs.rowBetweenCenter, gs.gap10, gs.px14, gs.py12]}>
          <TouchableOpacity
            onPress={() => navigate('AccountsScreen')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.fieldValue', {field: t('money.toSpend'), value: figure})}
            testID="held-in-hand"
            style={[gs.flex1, gs.minTouch]}>
            <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
              {t('money.toSpend')}
            </PrimaryText>
            <Amount size={26} weight="bold" color={inHand < 0 ? colors.accentRed : undefined}>
              {figure}
            </Amount>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigate('TransferScreen', {})}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.transfer')}
            testID="held-move"
            style={[
              gs.rowCenter,
              gs.gap6,
              gs.px12,
              gs.py8,
              gs.rounded10,
              gs.minH45,
              {backgroundColor: colors.secondaryAccent},
            ]}>
            <Icon name="arrow-left-right" size={14} color={colors.primaryText} />
            <PrimaryText size={13} weight="semibold">
              {t('money.move')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
        <ProSlot feature="recurring">
          <DueLine inHand={inHand} />
        </ProSlot>
      </View>
      <PrimaryText size={11} color={colors.secondaryText} style={[gs.mt6, gs.px3]}>
        {checked ? t('money.checkedOn', {date: formatDisplayDate(checked, 'dayMonth')}) : t('money.neverChecked')}
      </PrimaryText>
      <ProSlot feature="recurring">
        <VariesNote />
      </ProSlot>
    </View>
  );
};

const styles = StyleSheet.create({
  divider: {height: 1},
});
