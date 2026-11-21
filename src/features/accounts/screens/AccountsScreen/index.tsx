import React, {useMemo, useState} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Icon} from '../../../../ui/atoms/Icons';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useNetWorth} from '../../../../ui/hooks/useNetWorth';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {lessOf} from '../../../../domain/commitments';
import {fromMoneyUnits, toMoneyUnits} from '../../../../domain/money';
import type {AccountBalance} from '../../../../data/services/netWorthService';
import {AccountBalanceRow} from '../../../../ui/molecules/AccountBalanceRow';
import {AccountSections} from '../../../../ui/molecules/AccountSections';
import {CLASS_ICON, CLASS_LABEL, CLASS_MEANING, formatBalance} from '../../../../ui/accountWords';
import {SheetManager} from 'react-native-actions-sheet';
import {ACCOUNT_CLASSES} from '../../../../domain/accounts';
import {signedAmount} from '../../accountCopy';
import {gs} from '../../../../ui/globalStyles';

/**
 * Every account with its balance today, held and owed together: Spend, Save,
 * Card, Loan, each with its subtotal (the Money tab lists the first two, the
 * Debts tab the last two). Net worth closes the screen as the last line of
 * the sum, with the debts-with-people line that completes it, so the screen
 * adds up. One action is pinned in reach: moving money. Archived accounts
 * are folded away, and only here.
 */
export const AccountsScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {worth, failed} = useNetWorth(true);
  const [showArchived, setShowArchived] = useState(false);

  const archived = useMemo(() => (worth?.accounts ?? []).filter(account => !account.active), [worth]);
  // Net worth also holds what people owe the user and what the user owes them: the line that completes the sum.
  const debts = useMemo(() => {
    if (!worth) {
      return 0;
    }
    const inAccounts = fromMoneyUnits(worth.accounts.reduce((units, a) => units + toMoneyUnits(a.balance), 0));
    return lessOf(worth.total, inAccounts);
  }, [worth]);
  const open = (account: AccountBalance) => navigate('AccountScreen', {accountId: account.accountId});
  const payBill = (account: AccountBalance) =>
    navigate('TransferScreen', {toAccountId: account.accountId, amount: 0 - account.balance});

  // This screen lists every class, so its plus offers every class (round two, item 6).
  const addAccount = () => {
    void SheetManager.show('add-choice-sheet', {
      payload: {
        title: t('accounts.add'),
        choices: ACCOUNT_CLASSES.map(accountClass => ({
          name: accountClass,
          icon: CLASS_ICON[accountClass],
          label: t(CLASS_LABEL[accountClass]),
          hint: t(CLASS_MEANING[accountClass]),
          onPress: () => navigate('AccountFormScreen', {accountClass}),
        })),
      },
    });
  };

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader
          onPress={goBack}
          colors={colors}
          text={t('accounts.title')}
          rightAction={
            <TouchableOpacity
              onPress={addAccount}
              accessibilityRole="button"
              accessibilityLabel={t('accounts.add')}
              style={gs.minTouch}>
              <Icon name="plus" size={22} color={colors.primaryText} />
            </TouchableOpacity>
          }
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={gs.flex1}>
        {failed ? (
          <PrimaryText size={13} color={colors.accentRed} style={gs.mb15}>
            {t('accounts.loadFailed')}
          </PrimaryText>
        ) : null}
        <AccountSections classes={ACCOUNT_CLASSES} accounts={worth?.accounts ?? []} onOpen={open} onPayBill={payBill} />
        {archived.length > 0 ? (
          <View style={gs.mb15}>
            <TouchableOpacity
              onPress={() => setShowArchived(shown => !shown)}
              accessibilityRole="button"
              accessibilityState={{expanded: showArchived}}
              style={[gs.minTouch, gs.rowCenter, gs.justifyStart, gs.gap6]}>
              <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
                {t('accounts.groupArchived')}
              </PrimaryText>
              <Icon name={showArchived ? 'chevron-down' : 'chevron-right'} size={14} color={colors.secondaryText} />
            </TouchableOpacity>
            {showArchived ? (
              <ListSection>
                {archived.map(account => (
                  <AccountBalanceRow key={account.accountId} account={account} onPress={() => open(account)} />
                ))}
              </ListSection>
            ) : null}
          </View>
        ) : null}
        {worth ? (
          <ListSection style={gs.mb20}>
            {debts !== 0 ? (
              <ListRow title={t('accounts.debtsWithPeople')} amount={signedAmount(formatAmount, debts)} />
            ) : null}
            <ListRow
              icon="bar-chart-3"
              title={t('accounts.netWorthTitle')}
              amount={formatBalance(formatAmount, worth.total)}
              onPress={() => navigate('NetWorthScreen')}
              chevron
            />
          </ListSection>
        ) : null}
      </ScrollView>
      <View style={gs.pt10}>
        <PrimaryButton
          onPress={() => navigate('TransferScreen', {})}
          colors={colors}
          buttonTitle={t('accounts.transfer')}
          icon="arrow-left-right"
        />
      </View>
    </PrimaryView>
  );
};
