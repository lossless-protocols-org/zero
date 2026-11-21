import React from 'react';
import {useTranslation} from 'react-i18next';
import {TouchableOpacity} from 'react-native';
import {PrimaryText} from '../atoms/PrimaryText';
import {gs} from '../globalStyles';
import {ListRow} from './ListRow';
import {useThemeColors} from '../hooks/useThemeColors';
import {useFormatAmount} from '../hooks/useFormatAmount';
import {displayAccountName} from '../../i18n/displayNames';
import {formatDisplayDate} from '../../platform/dateFormat';
import type {AccountBalance} from '../../data/services/netWorthService';
import {classOf, isOwedType} from '../../domain/accounts';
import {formatBalance} from '../accountWords';

interface AccountBalanceRowProps {
  account: AccountBalance;
  onPress: () => void;
  /** A card that is owed on: pay its bill. Left out: no button. */
  onPayBill?: () => void;
}

/**
 * One account in a list: its icon, its name, what is worth knowing about it
 * (new entries go here, or when its balance was last set by hand) and its
 * balance. A card or a loan below zero shows what is owed, in red, as a
 * person you owe does (round two, item 7: red is the owed side, green is
 * yours, each beside its word). Paid beyond nothing, the lender owes you,
 * and the row says so (approved A2). An account you hold that has gone
 * below zero (an overdraft) is red too and says "Below zero".
 */
export const AccountBalanceRow: React.FC<AccountBalanceRowProps> = ({account, onPress, onPayBill}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const name = displayAccountName(account.name, t);
  const owedType = isOwedType(account.type);
  const owed = owedType && account.balance < 0;
  const inCredit = owedType && account.balance > 0;
  const overdrawn = !owedType && account.balance < 0;
  const figure = owed ? formatAmount(-account.balance) : formatBalance(formatAmount, account.balance);
  const spoken = owed
    ? t('accounts.youOweAmount', {amount: figure})
    : inCredit
      ? t('accounts.owesYouAmount', {amount: figure})
      : figure;
  const checked = account.anchorDate
    ? t(classOf(account.type) === 'save' ? 'accounts.valueFrom' : 'accounts.checkedOn', {
        date: formatDisplayDate(account.anchorDate, 'dayMonth'),
      })
    : undefined;
  return (
    <ListRow
      dynamicIcon={account.icon}
      iconColor={account.color || colors.primaryText}
      title={name}
      subtitle={
        overdrawn
          ? t('accounts.belowZero')
          : account.isDefault
            ? t('accounts.defaultBadge')
            : inCredit
              ? t('accounts.owesYou')
              : checked
      }
      amount={figure}
      amountColor={inCredit ? colors.accentGreen : owed || overdrawn ? colors.accentRed : undefined}
      onPress={onPress}
      chevron={false}
      accessibilityLabel={t('accounts.rowA11y', {name, amount: spoken})}
      trailing={
        owed && onPayBill && classOf(account.type) === 'card' ? (
          <TouchableOpacity
            onPress={onPayBill}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.payBill')}
            style={[gs.px12, gs.py8, gs.rounded10, gs.center, gs.minH45, {backgroundColor: colors.primaryText}]}>
            <PrimaryText size={13} weight="semibold" color={colors.buttonText}>
              {t('accounts.payBill')}
            </PrimaryText>
          </TouchableOpacity>
        ) : undefined
      }
    />
  );
};
