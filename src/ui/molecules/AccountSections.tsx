import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ListSection} from './ListSection';
import {ListRow} from './ListRow';
import {AccountBalanceRow} from './AccountBalanceRow';
import {Icon} from '../atoms/Icons';
import {useThemeColors, type ThemeColors} from '../hooks/useThemeColors';
import {useFormatAmount} from '../hooks/useFormatAmount';
import {gs} from '../globalStyles';
import type {AccountBalance} from '../../data/services/netWorthService';
import {accountKindKey, classOf, sideOf, type AccountClass} from '../../domain/accounts';
import {fromMoneyUnits, toMoneyUnits} from '../../domain/money';
import {CLASS_ICON, CLASS_LABEL, formatBalance, kindLabelOf} from '../accountWords';

/** Balances together; what is owed on cards and loans reads as a positive figure. */
const subtotalOf = (accountClass: AccountClass, accounts: readonly AccountBalance[]): number => {
  const sum = fromMoneyUnits(accounts.reduce((units, account) => units + toMoneyUnits(account.balance), 0));
  return sideOf(accountClass) === 'owed' ? 0 - sum : sum;
};

/**
 * Round two, item 7: what is owed, and anything held that is below zero, is
 * red; a card or loan paid beyond nothing is green. `subtotal` is as
 * subtotalOf gives it (what is owed reads as a positive figure).
 */
const toneOf = (accountClass: AccountClass, subtotal: number, colors: ThemeColors): string | undefined => {
  if (sideOf(accountClass) === 'owed') {
    return subtotal > 0 ? colors.accentRed : subtotal < 0 ? colors.accentGreen : undefined;
  }
  return subtotal < 0 ? colors.accentRed : undefined;
};

interface KindGroup {
  key: string;
  label: string;
  accounts: AccountBalance[];
}

/** Accounts of one class in the user's order, gathered by kind where two or more share one. */
const byKind = (accounts: readonly AccountBalance[], labelOf: (account: AccountBalance) => string): KindGroup[] => {
  const groups: KindGroup[] = [];
  const index = new Map<string, KindGroup>();
  for (const account of accounts) {
    const label = labelOf(account);
    const key = label ? accountKindKey(label) : `#${account.accountId}`;
    const found = index.get(key);
    if (found) {
      found.accounts.push(account);
    } else {
      const group = {key, label, accounts: [account]};
      index.set(key, group);
      groups.push(group);
    }
  }
  return groups;
};

interface AccountSectionsProps {
  /** Which classes to list, in this order: the Money tab's are held, the Debts tab's are owed. */
  classes: readonly AccountClass[];
  /** Every account with its balance; archived ones are left out here. */
  accounts: readonly AccountBalance[];
  onOpen: (account: AccountBalance) => void;
  /** A card that is owed on: pay its bill. */
  onPayBill?: (account: AccountBalance) => void;
}

/**
 * The accounts of the classes asked for, one section per class under its
 * one-word heading with the class's subtotal (approved model A2/A3). Two or
 * more accounts of one kind fold into one row with their subtotal; a tap
 * opens them. The kind is a label only: every figure here is summed by
 * class. A class with no account has no section.
 */
export const AccountSections: React.FC<AccountSectionsProps> = ({classes, accounts, onOpen, onPayBill}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const colors = useThemeColors();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setOpen(current => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const sections = useMemo(
    () =>
      classes.flatMap(accountClass => {
        const own = accounts.filter(account => account.active && classOf(account.type) === accountClass);
        return own.length > 0 ? [{accountClass, own, groups: byKind(own, account => kindLabelOf(account, t))}] : [];
      }),
    [classes, accounts, t],
  );

  return (
    <>
      {sections.map(({accountClass, own, groups}) => (
        <ListSection
          key={accountClass}
          title={t(CLASS_LABEL[accountClass])}
          trailing={formatBalance(formatAmount, subtotalOf(accountClass, own))}
          trailingColor={toneOf(accountClass, subtotalOf(accountClass, own), colors)}
          style={gs.mb15}>
          {groups.flatMap(group => {
            const row = (account: AccountBalance) => (
              <AccountBalanceRow
                key={account.accountId}
                account={account}
                onPress={() => onOpen(account)}
                onPayBill={onPayBill ? () => onPayBill(account) : undefined}
              />
            );
            if (group.accounts.length < 2) {
              return group.accounts.map(row);
            }
            const id = `${accountClass}:${group.key}`;
            const shown = open.has(id);
            const figure = formatBalance(formatAmount, subtotalOf(accountClass, group.accounts));
            const count = t('accounts.kindCount', {count: group.accounts.length});
            return [
              <ListRow
                key={id}
                dynamicIcon={CLASS_ICON[accountClass]}
                title={group.label}
                subtitle={count}
                amount={figure}
                amountColor={toneOf(accountClass, subtotalOf(accountClass, group.accounts), colors)}
                onPress={() => toggle(id)}
                chevron={false}
                trailing={
                  <Icon name={shown ? 'chevron-down' : 'chevron-right'} size={14} color={colors.secondaryText} />
                }
                accessibilityLabel={t(shown ? 'accounts.kindOpenA11y' : 'accounts.kindFoldedA11y', {
                  kind: group.label,
                  howMany: count,
                  amount: figure,
                })}
                testID={`kind-${id}`}
              />,
              ...(shown ? group.accounts.map(row) : []),
            ];
          })}
        </ListSection>
      ))}
    </>
  );
};
