import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {ProSlot} from '../../../ui/atoms/ProSlot';
import {ListRow} from '../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {useCommitments} from '../../../ui/hooks/useCommitments';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {navigate} from '../../../platform/navigationUtils';
import {gs} from '../../../ui/globalStyles';

/** The next bill or repayment the user has set, and the way into Coming up. Pro, recurring on. */
const NextDue: React.FC = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {due} = useCommitments(true);
  const next = due.find(item => item.paysDebt);
  if (!next) {
    return null;
  }
  const when = formatDisplayDate(next.day, 'dayMonth');
  const title = t('debts.nextIs', {title: next.title});
  const subtitle = next.amount === null ? t('debts.nextVaries', {date: when}) : when;
  const amount = next.amount === null ? undefined : formatAmount(next.amount);
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
        accessibilityLabel={[title, subtitle, amount].filter(Boolean).join(', ')}
        testID="owed-next-due"
      />
    </>
  );
};

/**
 * The top of the Debts tab with Pro (approved A2; round two item 5), the
 * same shape as the Money tab's: the tab's one number, what you owe across
 * cards, loans and people, with what is owed to you beside it, and under it
 * the next bill or repayment the user has set. Red is the owed side and
 * green is yours, each beside its words (item 7). Mounted only with
 * accounts on.
 */
export const OwedCard: React.FC<{youOwe: number; owedToYou: number}> = ({youOwe, owedToYou}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  return (
    <View style={[gs.rounded12, gs.overflowHidden, gs.mb15, {backgroundColor: colors.containerColor}]}>
      <View style={[gs.row, gs.wrap, gs.justifyBetween, gs.itemsEnd, gs.gap10, gs.px14, gs.py12]}>
        <View accessible accessibilityLabel={t('debts.youOweA11y', {amount: formatAmount(youOwe)})}>
          <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
            {t('accounts.lineYouOwe')}
          </PrimaryText>
          <Amount size={26} weight="bold" color={youOwe > 0 ? colors.accentRed : undefined}>
            {formatAmount(youOwe)}
          </Amount>
        </View>
        <View
          style={gs.itemsEnd}
          accessible
          accessibilityLabel={t('debts.owedToYouA11y', {amount: formatAmount(owedToYou)})}>
          <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
            {t('accounts.lineOwedToYou')}
          </PrimaryText>
          <Amount size={15} weight="bold" color={owedToYou > 0 ? colors.accentGreen : undefined}>
            {formatAmount(owedToYou)}
          </Amount>
        </View>
      </View>
      <ProSlot feature="recurring">
        <NextDue />
      </ProSlot>
    </View>
  );
};

const styles = StyleSheet.create({
  divider: {height: 1},
});
