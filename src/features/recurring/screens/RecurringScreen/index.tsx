import React, {useMemo, useState} from 'react';
import {ScrollView, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Amount} from '../../../../ui/atoms/Amount';
import {Icon} from '../../../../ui/atoms/Icons';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useCommitments} from '../../../../ui/hooks/useCommitments';
import {foldByRule} from '../../../../domain/commitments';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../../ui/hooks/useFormatAmount';
import {formatDisplayDate} from '../../../../platform/dateFormat';
import {goBack, navigate} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {shiftIsoDay, todayIsoDay} from '../../../../domain/dates';
import type {RuleTarget} from '../../../../domain/recurrence';
import type {ParseKeys} from 'i18next';
import {useRecurring} from '../../hooks/useRecurring';
import {RuleRow} from '../../components/RuleRow';
import {gs} from '../../../../ui/globalStyles';

const SECTIONS: ReadonlyArray<{target: RuleTarget; label: ParseKeys}> = [
  {target: 'expense', label: 'recurring.sectionExpenses'},
  {target: 'income', label: 'recurring.sectionIncome'},
  {target: 'transfer', label: 'recurring.sectionTransfers'},
];

/** A day of the month as a row's tile: the date is what the eye looks for in a list of what is coming. */
const DayTile: React.FC<{day: string}> = ({day}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.size36, gs.center, gs.rounded10, {backgroundColor: colors.iconContainer}]}>
      <PrimaryText size={14} weight="bold" variant="number" allowFontScaling={false}>
        {String(Number(day.slice(8, 10)))}
      </PrimaryText>
    </View>
  );
};

/**
 * What is coming up (3.0, plan P9; UX revamp v2). The screen answers "what
 * leaves my accounts before the month is out, and how much in all": the sum
 * still to pay, then whatever waits for the user (one shape for an amount
 * to enter and for entries missed), then the rest of the month by day. The
 * rules themselves are set once and rarely opened, so they fold away at the
 * bottom. Every way of making an entry here is a deliberate tap.
 */
export const RecurringScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();
  const {rules, behind, asks, addMissed, skipMissed, skipAsk} = useRecurring();
  const {due, still, nextStart} = useCommitments(true);
  const [showRules, setShowRules] = useState(false);
  const today = todayIsoDay();
  const tomorrow = shiftIsoDay(today, 1);
  const whenOf = (day: string): string =>
    day === today
      ? t('recurring.whenToday')
      : day === tomorrow
        ? t('recurring.whenTomorrow')
        : formatDisplayDate(day, 'dayMonth');
  const byTarget = useMemo(
    () => new Map(SECTIONS.map(({target}) => [target, rules.filter(rule => rule.target === target)])),
    [rules],
  );
  const coming = useMemo(() => foldByRule(due), [due]);
  const before = formatDisplayDate(nextStart, 'dayMonth');
  const waiting = behind.length + asks.length;

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader
          onPress={goBack}
          colors={colors}
          text={t('recurring.title')}
          rightAction={
            <TouchableOpacity
              onPress={() => navigate('RuleFormScreen', {})}
              accessibilityRole="button"
              accessibilityLabel={t('recurring.add')}
              style={gs.minTouch}>
              <Icon name="plus" size={22} color={colors.primaryText} />
            </TouchableOpacity>
          }
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.pb80}>
        {rules.length === 0 ? (
          <View style={[gs.py12, gs.mb15]}>
            <PrimaryText size={15} weight="semibold" style={gs.mb5}>
              {t('recurring.emptyTitle')}
            </PrimaryText>
            <PrimaryText size={13} color={colors.secondaryText} style={gs.mb15}>
              {t('recurring.emptyBody')}
            </PrimaryText>
            <PrimaryButton
              onPress={() => navigate('RuleFormScreen', {})}
              colors={colors}
              buttonTitle={t('recurring.add')}
            />
          </View>
        ) : (
          <View style={[gs.py12, gs.px14, gs.rounded12, gs.mb15, {backgroundColor: colors.containerColor}]}>
            <PrimaryText size={11} weight="medium" color={colors.secondaryText}>
              {still.items.length > 0
                ? t('recurring.stillToPay', {date: before})
                : t('recurring.nothingToPay', {date: before})}
            </PrimaryText>
            {still.items.length > 0 ? (
              <Amount size={24} weight="bold">
                {formatAmount(still.total)}
              </Amount>
            ) : null}
            {still.varies.length > 0 ? (
              <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
                {t('money.plusVaries', {titles: still.varies.join(', ')})}
              </PrimaryText>
            ) : null}
          </View>
        )}

        {waiting > 0 ? (
          <ListSection title={t('recurring.needsYou', {count: waiting})} tone="attention" style={gs.mb15}>
            {asks.map(ask => (
              <View key={`${ask.ruleId}:${ask.index}`}>
                <ListRow
                  icon="alert-circle"
                  iconColor={colors.accentOrange}
                  title={ask.title}
                  subtitle={t('recurring.dueVaries', {date: formatDisplayDate(ask.day, 'dayMonth')})}
                />
                <View style={[gs.row, gs.gap10, gs.px14, gs.pb10]}>
                  <View style={gs.flex1}>
                    <PrimaryButton
                      onPress={() => logRejection(skipAsk(ask))}
                      colors={colors}
                      buttonTitle={t('recurring.skip')}
                      variant="outline"
                      size="sm"
                    />
                  </View>
                  <View style={gs.flex1}>
                    <PrimaryButton
                      onPress={() => navigate('ConfirmRecurringScreen', {ruleId: ask.ruleId, index: ask.index})}
                      colors={colors}
                      buttonTitle={t('recurring.confirm')}
                      size="sm"
                    />
                  </View>
                </View>
              </View>
            ))}
            {behind.map(rule => (
              <View key={rule.ruleId}>
                <ListRow
                  icon="alert-circle"
                  iconColor={colors.accentOrange}
                  title={rule.title}
                  subtitle={t('recurring.missedLine', {count: rule.missed})}
                />
                <View style={[gs.row, gs.gap10, gs.px14, gs.pb10]}>
                  <View style={gs.flex1}>
                    <PrimaryButton
                      onPress={() => logRejection(skipMissed(rule.ruleId))}
                      colors={colors}
                      buttonTitle={t('recurring.missedSkip')}
                      variant="outline"
                      size="sm"
                    />
                  </View>
                  <View style={gs.flex1}>
                    <PrimaryButton
                      onPress={() => logRejection(addMissed(rule.ruleId))}
                      colors={colors}
                      buttonTitle={t('recurring.missedAdd')}
                      size="sm"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ListSection>
        ) : null}

        <ListSection title={t('recurring.before', {date: before})} style={gs.mb15}>
          {coming.map(item => {
            const when = whenOf(item.day);
            const amount =
              item.sum === null
                ? t('recurring.variesShort')
                : item.target === 'income'
                  ? `+${formatAmount(item.sum)}`
                  : formatAmount(item.sum);
            const subtitle = item.more > 0 ? t('recurring.moreTimes', {when, count: item.more}) : when;
            return (
              <ListRow
                key={`${item.ruleId}:${item.index}`}
                tile={<DayTile day={item.day} />}
                title={item.title}
                subtitle={subtitle}
                amount={amount}
                amountColor={
                  item.sum === null
                    ? colors.secondaryText
                    : item.target === 'income'
                      ? colors.accentGreen
                      : colors.primaryText
                }
                onPress={() => navigate('RuleFormScreen', {ruleId: item.ruleId})}
                chevron={false}
                accessibilityLabel={t('recurring.dueA11y', {title: item.title, when: subtitle, amount})}
              />
            );
          })}
        </ListSection>

        {rules.length > 0 ? (
          <View style={gs.mb15}>
            <TouchableOpacity
              onPress={() => setShowRules(shown => !shown)}
              accessibilityRole="button"
              accessibilityState={{expanded: showRules}}
              style={[gs.minTouch, gs.row, gs.itemsCenter, gs.justifyStart, gs.gap6]}>
              <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
                {t('recurring.allRules')}
              </PrimaryText>
              <PrimaryText size={12} weight="semibold" variant="number" color={colors.secondaryText}>
                {String(rules.length)}
              </PrimaryText>
              <Icon name={showRules ? 'chevron-down' : 'chevron-right'} size={14} color={colors.secondaryText} />
            </TouchableOpacity>
            {showRules
              ? SECTIONS.map(({target, label}) => {
                  const list = byTarget.get(target) ?? [];
                  return (
                    <ListSection key={target} title={t(label)} style={gs.mb12}>
                      {list.map(rule => (
                        <RuleRow
                          key={rule.id}
                          rule={rule}
                          onPress={() => navigate('RuleFormScreen', {ruleId: rule.id})}
                        />
                      ))}
                    </ListSection>
                  );
                })
              : null}
          </View>
        ) : null}
      </ScrollView>
    </PrimaryView>
  );
};
