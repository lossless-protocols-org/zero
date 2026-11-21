import {ScrollView, View} from 'react-native';
import {AddFab} from '../../../../ui/atoms/AddFab';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {HeaderContainer} from '../../../../ui/molecules/HeaderContainer';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {AccountSections} from '../../../../ui/molecules/AccountSections';
import {navigate} from '../../../../platform/navigationUtils';
import {OwedCard} from '../../components/OwedCard';
import {NetWorthLine} from '../../components/NetWorthLine';
import {useDebts, type DebtorRow} from './useDebts';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {EmptyState} from '../../../../ui/atoms/EmptyState';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useProFeature} from '../../../../ui/hooks/useProFeature';
import {useNetWorth} from '../../../../ui/hooks/useNetWorth';
import {DataErrorBanner} from '../../../../ui/atoms/DataErrorBanner';
import {useDataError} from '../../../../ui/hooks/useDataError';
import {CLASS_ICON, CLASS_LABEL, CLASS_MEANING} from '../../../../ui/accountWords';
import {isOwedType} from '../../../../domain/accounts';
import type {AccountBalance} from '../../../../data/services/netWorthService';
import type {ThemeColors} from '../../../../ui/hooks/useThemeColors';
import {gs} from '../../../../ui/globalStyles';

/** Thunk domains the Debts tab loads from. */
const DEBTS_DOMAINS = ['debtor', 'debt', 'user'];
const OWED_CLASSES = ['card', 'loan'] as const;

const openAccount = (account: AccountBalance) => navigate('AccountScreen', {accountId: account.accountId});
const payBill = (account: AccountBalance) =>
  navigate('TransferScreen', {toAccountId: account.accountId, amount: 0 - account.balance});
const openDebtor = (debtorId: string) => navigate('IndividualDebtsScreen', {debtorId});
const addPerson = () => navigate('AddDebtorScreen');

/** Red is the owed side, green is yours (round two, item 7). `net` above zero: you owe. */
const toneOf = (net: number, colors: ThemeColors): string | undefined =>
  net > 0 ? colors.accentRed : net < 0 ? colors.accentGreen : undefined;

/**
 * People, or the free app's simple card and loan tallies, as one grouped
 * section in the row style cards and loans use (round two, item 5). The
 * heading carries what they net to. No rows, no section (world review W7).
 */
const DebtorSection: React.FC<{title: string; rows: readonly DebtorRow[]; net: number; colors: ThemeColors}> = ({
  title,
  rows,
  net,
  colors,
}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  return (
    <ListSection
      title={title}
      trailing={net === 0 ? undefined : formatAmount(Math.abs(net))}
      trailingColor={toneOf(net, colors)}
      style={gs.mb15}>
      {rows.map(row => {
        const label = row.net > 0 ? t('debts.youOwe') : row.net < 0 ? t('debts.owesYou') : t('debts.settled');
        const amount = formatAmount(Math.abs(row.net));
        return (
          <ListRow
            key={row.id}
            dynamicIcon={row.icon || 'user'}
            iconColor={row.color || colors.primaryText}
            title={row.title}
            subtitle={label}
            amount={amount}
            amountColor={toneOf(row.net, colors)}
            onPress={() => openDebtor(row.id)}
            chevron={false}
            accessibilityLabel={`${row.title}, ${label}, ${amount}`}
            testID={`debtor-${row.id}`}
          />
        );
      })}
    </ListSection>
  );
};

/**
 * The Debts tab: what is owed, either way (approved A2; round two item 5).
 * One top card, then sections in one row style: with Pro, Card and Loan;
 * for everyone, People, and the simple card and loan tallies the free app
 * has always kept while any remain. A section with nothing in it is not
 * drawn, so someone who only lends to friends sees only People (W7). Without
 * Pro no account surface exists (L8). One plus: with Pro it asks Person,
 * Card or Loan; without, it adds a person.
 */
export const DebtsScreen = () => {
  const {colors, people, tallies, peopleNet, talliesNet, totalDebts, empty} = useDebts();
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const pro = useProFeature('accounts');
  const {worth} = useNetWorth(pro);
  // A failed load is not "no debts yet": the banner says so.
  const dataError = useDataError(DEBTS_DOMAINS);

  const add = useCallback(() => {
    if (!pro) {
      addPerson();
      return;
    }
    void SheetManager.show('add-choice-sheet', {
      payload: {
        title: t('debts.addToDebts'),
        choices: [
          {name: 'person', icon: 'user', label: t('debts.person'), hint: t('debts.meansPerson'), onPress: addPerson},
          ...OWED_CLASSES.map(accountClass => ({
            name: accountClass,
            icon: CLASS_ICON[accountClass],
            label: t(CLASS_LABEL[accountClass]),
            hint: t(CLASS_MEANING[accountClass]),
            onPress: () => navigate('AccountFormScreen', {accountClass}),
          })),
        ],
      },
    });
  }, [pro, t]);

  const overallLabel =
    totalDebts > 0 ? t('debts.youOweOthers') : totalDebts < 0 ? t('debts.othersOweYou') : t('debts.allSettled');
  const hasOwedAccounts = worth?.accounts.some(account => account.active && isOwedType(account.type)) ?? false;

  return (
    <PrimaryView colors={colors} useBottomPadding={false} useSidePadding={false}>
      <View style={[gs.px16, gs.mb15]}>
        <HeaderContainer headerText={t('debts.title')} />
      </View>
      <View style={gs.px16}>
        <DataErrorBanner domains={DEBTS_DOMAINS} />
      </View>
      <ScrollView contentContainerStyle={[gs.px16, gs.pb100]} showsVerticalScrollIndicator={false}>
        {pro && worth ? (
          <OwedCard youOwe={worth.lines.youOwe} owedToYou={worth.lines.owedToYou} />
        ) : pro ? null : (
          <View style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, gs.center, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={11} weight="medium" color={colors.secondaryText} style={gs.mb5}>
              {overallLabel}
            </PrimaryText>
            <Amount size={28} weight="bold" color={toneOf(totalDebts, colors) ?? colors.primaryText}>
              {formatAmount(Math.abs(totalDebts))}
            </Amount>
          </View>
        )}
        {pro && worth ? (
          <AccountSections classes={OWED_CLASSES} accounts={worth.accounts} onOpen={openAccount} onPayBill={payBill} />
        ) : null}
        <DebtorSection title={t('debts.tabPerson')} rows={people} net={peopleNet} colors={colors} />
        <DebtorSection
          title={t(pro ? 'debts.tabTallies' : 'debts.tabAccounts')}
          rows={tallies}
          net={talliesNet}
          colors={colors}
        />
        {empty && !dataError && !(pro && hasOwedAccounts) ? <EmptyState colors={colors} type={'Debts'} /> : null}
        {pro && worth ? <NetWorthLine total={worth.total} /> : null}
      </ScrollView>
      <AddFab kind="person" onPress={add} label={pro ? t('debts.addToDebts') : t('debts.addDebtor')} colors={colors} />
    </PrimaryView>
  );
};
