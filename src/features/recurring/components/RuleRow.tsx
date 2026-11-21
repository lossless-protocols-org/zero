import React from 'react';
import {useTranslation} from 'react-i18next';
import {ListRow} from '../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {todayIsoDay} from '../../../domain/dates';
import type {RuleData} from '../../../data/services/recurringService';
import type {RuleTarget} from '../../../domain/recurrence';
import type {IconName} from '../../../ui/atoms/IconRegistry';
import {STATUS_LABEL, scheduleText} from '../ruleCopy';

interface RuleRowProps {
  rule: RuleData;
  onPress: () => void;
}

const TARGET_ICON: Record<RuleTarget, IconName> = {
  expense: 'receipt',
  income: 'banknote',
  transfer: 'arrow-left-right',
};

/**
 * One rule: its name, how often and when next (or why it is not running),
 * and its amount or "varies". A rule whose next day has passed is waiting
 * for the user: it says so, where it used to print a past date as "next"
 * (UX revamp v2). A paused or ended rule is dimmed.
 */
export const RuleRow: React.FC<RuleRowProps> = ({rule, onPress}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const schedule = scheduleText(rule.cadence, rule.interval, t);
  const statusKey = STATUS_LABEL[rule.status];
  const subtitle =
    statusKey !== undefined || rule.nextRun === null
      ? t(statusKey ?? 'recurring.statusEnded')
      : rule.nextRun < todayIsoDay()
        ? t('recurring.rowWaiting', {cadence: schedule})
        : t('recurring.rowSubtitle', {cadence: schedule, date: formatDisplayDate(rule.nextRun, 'dayMonth')});
  const amount = rule.amount === null ? t('recurring.variesShort') : formatAmount(rule.amount);
  return (
    <ListRow
      icon={TARGET_ICON[rule.target]}
      title={rule.title}
      subtitle={subtitle}
      amount={amount}
      amountColor={rule.amount === null ? colors.secondaryText : colors.primaryText}
      dimmed={rule.status === 'paused' || rule.status === 'ended'}
      onPress={onPress}
      chevron={false}
      accessibilityLabel={t('recurring.rowA11y', {title: rule.title, amount, schedule: subtitle})}
    />
  );
};
