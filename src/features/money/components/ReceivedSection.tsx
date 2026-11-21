import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import {MonthNavigator} from '../../../ui/atoms/MonthNavigator';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {displayCategoryName} from '../../../i18n/displayNames';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {hexToRgba} from '../../../ui/colorUtils';
import {gs} from '../../../ui/globalStyles';
import type {CategoryData, IncomeData} from '../../../domain/types';
import {sumAmounts} from '../../../domain/money';

interface ReceivedSectionProps {
  colors: ThemeColors;
  monthLabel: string;
  canGoForward: boolean;
  onShiftMonth: (delta: -1 | 1) => void;
  onOpenMonthPicker: () => void;
  incomes: readonly IncomeData[];
  categories: readonly CategoryData[];
  /**
   * Without Pro, the one category every row is drawn under (src/pro/projection.ts): its icon and
   * colour, and no category name on the row, whatever the row's own category is. Null with Pro.
   */
  oneCategory: CategoryData | null;
  received: number;
  /** Null while unknown (not read yet, or the read failed): the line is left out, never guessed. */
  kept: number | null;
  /** The previous month's name ("October 2026"), on an empty month whose previous month had money in; else null. */
  copyFromMonth: string | null;
  onCopyLastMonth: () => void;
  onOpen: (incomeId: string) => void;
  /** Pro (P9): mark money in a recurring rule made. */
  showRepeat?: boolean;
}

/**
 * The Money tab's first section: what came in this month and what was kept
 * (R4: received − spent for the month, never a balance). Reads as a
 * statement, not a passbook: a total, then the month's entries. The Money
 * tab's "Received" tab names it and its green add button adds to it.
 */
const ReceivedSectionComponent: React.FC<ReceivedSectionProps> = ({
  colors,
  monthLabel,
  canGoForward,
  onShiftMonth,
  onOpenMonthPicker,
  incomes,
  categories,
  oneCategory,
  received,
  kept,
  copyFromMonth,
  onCopyLastMonth,
  onOpen,
  showRepeat = false,
}) => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const keptLine =
    kept === null
      ? null
      : kept >= 0
        ? t('money.receivedLine', {received: formatAmount(received), kept: formatAmount(kept)})
        : t('money.overReceivedLine', {received: formatAmount(received), over: formatAmount(-kept)});

  // With Pro and more than one income category, the month reads by category, each with its
  // total (ZERO_3.0_PRO.md §5); in the categories' own order. Otherwise one list, as in 2.8.
  // Counted among the active ones; an archived category still heads the rows it holds.
  const grouped = oneCategory === null && categories.filter(category => category.categoryStatus).length > 1;
  const groups = grouped
    ? [...categories, undefined]
        .map(category => {
          const rows = incomes.filter(income =>
            category ? income.categoryId === category.id : !categoryById.has(income.categoryId),
          );
          return {
            categoryId: category?.id ?? '',
            name: category ? displayCategoryName(category.name, t) : t('common.unknown'),
            total: sumAmounts(rows),
            incomes: rows,
          };
        })
        .filter(group => group.incomes.length > 0)
    : [{categoryId: '', name: '', total: received, incomes}];
  const renderRow = (income: IncomeData) => {
    const own = categoryById.get(income.categoryId);
    // The row's own category names it when it has no note, in both tiers: what it was is
    // the user's own word. Without Pro it is drawn under the one category, with no chip.
    const category = oneCategory ?? own;
    const ownName = own ? displayCategoryName(own.name, t) : '';
    const title = income.note || ownName;
    // Under a group header (or without Pro) the category is already said.
    const subtitleName = oneCategory || grouped ? '' : ownName;
    const day = formatDisplayDate(income.date, 'dayMonth');
    return (
      <TouchableOpacity
        key={income.id}
        onPress={() => onOpen(income.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('money.rowLabel', {title, amount: formatAmount(income.amount), date: day})}
        style={[gs.rowBetweenCenter, gs.px14, gs.py10, gs.rounded12, {backgroundColor: colors.containerColor}]}>
        <View style={[gs.rowCenter, gs.flex1]}>
          <View
            style={[
              gs.size36,
              gs.rounded10,
              gs.center,
              gs.mr10,
              {backgroundColor: hexToRgba(category?.color || colors.accentGreen, 0.094)},
            ]}>
            <Icon dynamicName={category?.icon || 'coins'} size={18} color={category?.color || colors.accentGreen} />
          </View>
          <View style={[gs.flex1, gs.gap2]}>
            <View style={[gs.rowCenter, gs.gap6]}>
              <PrimaryText weight="medium" numberOfLines={1} style={gs.flexShrink}>
                {title}
              </PrimaryText>
              {showRepeat && income.recurringId ? <Icon name="repeat" size={12} color={colors.secondaryText} /> : null}
            </View>
            <PrimaryText size={11} color={colors.secondaryText} numberOfLines={1}>
              {income.note && subtitleName ? `${subtitleName} · ${day}` : day}
            </PrimaryText>
          </View>
        </View>
        <Amount size={14} weight="semibold" color={colors.accentGreen}>
          {formatAmount(income.amount)}
        </Amount>
      </TouchableOpacity>
    );
  };

  return (
    <View style={gs.mb15}>
      <View style={[gs.px14, gs.py12, gs.rounded12, {backgroundColor: colors.containerColor}]}>
        <View style={gs.rowBetweenCenter}>
          <MonthNavigator
            label={monthLabel}
            canGoForward={canGoForward}
            onShift={onShiftMonth}
            onOpenPicker={onOpenMonthPicker}
            color={colors.primaryText}
            compact
          />
          <Amount size={20} weight="bold" color={colors.accentGreen}>
            {formatAmount(received)}
          </Amount>
        </View>
        {received > 0 && keptLine !== null ? (
          <Amount weight="medium" size={11} color={colors.secondaryText} style={gs.mt6}>
            {keptLine}
          </Amount>
        ) : null}
      </View>

      <View style={[gs.mt8, gs.gap6]}>
        {incomes.length === 0 ? (
          <PrimaryText size={12} color={colors.secondaryText} style={gs.py8}>
            {t('money.nothingReceived')}
          </PrimaryText>
        ) : null}
        {groups.map(group => (
          <View key={group.categoryId} style={gs.gap6}>
            {grouped ? (
              <View style={[gs.rowBetweenCenter, gs.mt6]} accessible accessibilityRole="header">
                <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
                  {group.name}
                </PrimaryText>
                <Amount size={12} weight="semibold" color={colors.secondaryText}>
                  {formatAmount(group.total)}
                </Amount>
              </View>
            ) : null}
            {group.incomes.map(renderRow)}
          </View>
        ))}
      </View>

      {copyFromMonth ? (
        <View style={[gs.rowCenter, gs.gap8, gs.mt10, gs.wrap]}>
          <TouchableOpacity
            onPress={onCopyLastMonth}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('money.copyFromMonth', {month: copyFromMonth})}
            style={[
              gs.rowCenter,
              gs.gap6,
              gs.px14,
              gs.py10,
              gs.minTouch,
              gs.roundedFull,
              {backgroundColor: colors.secondaryAccent},
            ]}>
            <PrimaryText size={13} color={colors.primaryText}>
              {t('money.sameAsLastMonth', {month: copyFromMonth})}
            </PrimaryText>
            <PrimaryText size={13} weight="semibold" color={colors.accentGreen}>
              {t('money.copyLastMonth')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

export const ReceivedSection = memo(ReceivedSectionComponent);
