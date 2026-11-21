import React from 'react';
import {useTranslation} from 'react-i18next';
import {ListRow} from '../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {displayAccountName} from '../../../i18n/displayNames';
import {formatDisplayDate} from '../../../platform/dateFormat';
import type {AccountEntry} from '../../../data/services/netWorthService';
import type {IconName} from '../../../ui/atoms/IconRegistry';
import {signedAmount} from '../accountCopy';

interface AccountEntryRowProps {
  entry: AccountEntry;
  onPress: () => void;
}

/** What kind of row it is, at a glance: money moved between accounts must never look like spending. */
const KIND_ICON: Record<AccountEntry['kind'], IconName> = {
  expense: 'receipt',
  refund: 'undo-2',
  income: 'banknote',
  transferIn: 'arrow-left-right',
  transferOut: 'arrow-left-right',
  lent: 'hand-coins',
  borrowed: 'hand-coins',
  checkpoint: 'badge-check',
};

/**
 * One line of an account's month: what it was and what it did to the
 * balance. A transfer carries its own icon and the words "Moved, not spent",
 * so a card bill or an SIP is never read as an expense (UX revamp v2).
 */
export const AccountEntryRow: React.FC<AccountEntryRowProps> = ({entry, onPress}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const moved = entry.kind === 'transferIn' || entry.kind === 'transferOut';
  const title = (() => {
    switch (entry.kind) {
      case 'transferIn':
        return t('accounts.transferIn', {name: displayAccountName(entry.label, t)});
      case 'transferOut':
        return t('accounts.transferOut', {name: displayAccountName(entry.label, t)});
      case 'refund':
        return t('accounts.refundLine', {title: entry.label});
      case 'income':
        return entry.label || t('accounts.incomeLine');
      case 'lent':
        return t('accounts.lentLine', {name: entry.label});
      case 'borrowed':
        return t('accounts.borrowedLine', {name: entry.label});
      case 'checkpoint':
        return t('accounts.checkpointLine', {amount: formatAmount(entry.amount)});
      default:
        return entry.label;
    }
  })();
  const figure = entry.kind === 'checkpoint' ? '' : signedAmount(formatAmount, entry.amount);
  const day = formatDisplayDate(entry.date, 'dayMonth');
  return (
    <ListRow
      icon={KIND_ICON[entry.kind]}
      iconColor={moved ? colors.accentBlue : undefined}
      title={title}
      subtitle={moved ? t('accounts.movedShort') : undefined}
      amount={figure || undefined}
      amountColor={entry.amount > 0 && entry.kind !== 'checkpoint' ? colors.accentGreen : colors.primaryText}
      onPress={onPress}
      chevron={false}
      accessibilityLabel={[title, moved ? t('accounts.movedShort') : '', figure, day].filter(Boolean).join(', ')}
    />
  );
};
