import React from 'react';
import {ScrollView, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {ParseKeys} from 'i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {Amount} from '../../../../ui/atoms/Amount';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {useNetWorth} from '../../../../ui/hooks/useNetWorth';
import {useCurrentPeriod} from '../../../../ui/hooks/useMonthStartDay';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import type {PeriodArticulation} from '../../../../data/services/netWorthService';
import {fromMoneyUnits, toMoneyUnits} from '../../../../domain/money';
import type {IconName} from '../../../../ui/atoms/IconRegistry';
import {signedAmount} from '../../accountCopy';
import {formatBalance} from '../../../../ui/accountWords';
import {gs} from '../../../../ui/globalStyles';

/** What the listed causes leave unexplained (0 whenever the articulation holds). */
const residualOf = (since: PeriodArticulation): number =>
  fromMoneyUnits(
    toMoneyUnits(since.netWorthChange) -
      [since.kept, since.revaluations, since.adjustments, since.openings, since.debtsOutsideAccounts].reduce(
        (sum, part) => sum + toMoneyUnits(part),
        0,
      ),
  );

const HAVE: ReadonlyArray<{key: 'cashAndBank' | 'investments' | 'owedToYou'; label: ParseKeys; icon: IconName}> = [
  {key: 'cashAndBank', label: 'accounts.lineCashAndBank', icon: 'wallet'},
  {key: 'investments', label: 'accounts.lineInvestments', icon: 'trending-up'},
  {key: 'owedToYou', label: 'accounts.lineOwedToYou', icon: 'hand-coins'},
];

/**
 * Net worth as a sum the eye can add (UX revamp v2): the total, a bar for
 * what is had against what is owed, the two groups with their own subtotals,
 * then this month's change as lines with their figures in a column and the
 * result last. The change used to be loose sentences, and "you owe" was
 * listed among the things had. No chart, no history (ZERO_3.0_PRO.md §5).
 */
export const NetWorthScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {worth, since, failed} = useNetWorth(true);
  const monthStart = useCurrentPeriod().start;
  const openAccounts = () => navigate('AccountsScreen');

  // Kept and the net change always; the rest only when they moved, so the usual month reads in two lines.
  const causes: Array<{label: ParseKeys; amount: number}> = since
    ? [
        {label: 'accounts.sinceKept' as const, amount: since.kept, always: true},
        {label: 'accounts.sinceInvestments' as const, amount: since.revaluations, always: false},
        {label: 'accounts.sinceUnexplained' as const, amount: since.adjustments, always: false},
        {label: 'accounts.sinceOpenings' as const, amount: since.openings, always: false},
        {label: 'accounts.sinceDebts' as const, amount: since.debtsOutsideAccounts, always: false},
        // Not explained by any term: a row on an account that no longer exists. Shown, never hidden.
        {label: 'accounts.sinceResidual' as const, amount: residualOf(since), always: !since.holds},
      ].filter(line => line.always || (line.amount !== 0 && line.label !== 'accounts.sinceResidual'))
    : [];

  const have = worth ? worth.lines.cashAndBank + worth.lines.investments + worth.lines.owedToYou : 0;
  const owe = worth ? worth.lines.youOwe : 0;
  // The bar's split; an overdrawn "have" has no share to draw.
  const haveShare = have > 0 || owe > 0 ? Math.max(have, 0) / (Math.max(have, 0) + owe) : 1;

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={goBack} colors={colors} text={t('accounts.netWorthTitle')} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {failed ? (
          <PrimaryText size={13} color={colors.accentRed} style={gs.mb15}>
            {t('accounts.loadFailed')}
          </PrimaryText>
        ) : null}
        {worth ? (
          <>
            <View style={[gs.mb15, gs.px3]}>
              <Amount size={32} weight="bold">
                {formatBalance(formatAmount, worth.total)}
              </Amount>
              <View
                accessible
                accessibilityLabel={t('accounts.haveOweA11y', {
                  have: formatBalance(formatAmount, have),
                  owe: formatAmount(owe),
                })}
                style={[gs.row, gs.h8, gs.mt8, gs.gap2]}>
                <View style={[gs.rounded4, {flex: haveShare, backgroundColor: colors.accentGreen}]} />
                {owe > 0 ? (
                  <View style={[gs.rounded4, {flex: 1 - haveShare, backgroundColor: colors.secondaryText}]} />
                ) : null}
              </View>
            </View>
            <ListSection title={t('accounts.whatYouHave')} trailing={formatBalance(formatAmount, have)} style={gs.mb15}>
              {HAVE.filter(line => line.key === 'cashAndBank' || worth.lines[line.key] !== 0).map(line => (
                <ListRow
                  key={line.key}
                  icon={line.icon}
                  title={t(line.label)}
                  amount={formatBalance(formatAmount, worth.lines[line.key])}
                  onPress={line.key === 'owedToYou' ? undefined : openAccounts}
                  chevron={false}
                />
              ))}
            </ListSection>
            {owe !== 0 ? (
              <ListSection title={t('accounts.whatYouOwe')} trailing={formatAmount(owe)} style={gs.mb15}>
                <ListRow
                  icon="credit-card"
                  title={t('accounts.lineYouOwe')}
                  amount={formatAmount(owe)}
                  onPress={openAccounts}
                  chevron={false}
                />
              </ListSection>
            ) : null}
          </>
        ) : null}
        {since ? (
          <ListSection
            title={t('accounts.sinceHeading', {date: formatDisplayDate(monthStart, 'dayMonth')})}
            style={gs.mb20}>
            {causes.map(line => (
              <ListRow key={line.label} title={t(line.label)} amount={signedAmount(formatAmount, line.amount)} />
            ))}
            <ListRow
              icon="bar-chart-3"
              title={t('accounts.sinceChange')}
              amount={signedAmount(formatAmount, since.netWorthChange)}
            />
          </ListSection>
        ) : null}
      </ScrollView>
    </PrimaryView>
  );
};
