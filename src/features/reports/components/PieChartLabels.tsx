import {StyleSheet, TouchableOpacity, View} from 'react-native';

const TRANSPARENT = 'transparent';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {Icon} from '../../../ui/atoms/Icons';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {hexToRgba} from '../../../ui/colorUtils';
import {formatPercent} from '../../../platform/numberFormat';
import {gs} from '../../../ui/globalStyles';

interface Label {
  /** Identity (the category id): selection and hiding match on it. */
  key: string;
  /** The category name as shown. */
  label: string;
  value: number;
  color: string;
  categoryId?: string;
  categoryIcon?: string;
}

interface PieChartLabelsProps {
  colors: ThemeColors;
  slices: Array<Label>;
  /** Key of the slice selected in the chart, so the rows stay in sync. */
  activeKey?: string | null;
  /** Slice keys the user has hidden from the chart; rows render dimmed. */
  excludedKeys?: ReadonlySet<string>;
  onToggleExclude?: (key: string) => void;
  /** Per-category monthly budget in force, keyed by category id. */
  categoryBudgets?: Record<string, {amount: number}>;
  onCategoryPress?: (categoryId: string) => void;
}

export const PieChartLabels: React.FC<PieChartLabelsProps> = React.memo(
  ({colors, slices, activeKey, excludedKeys, onToggleExclude, categoryBudgets, onCategoryPress}) => {
    const {t} = useTranslation();
    const formatAmount = useFormatAmount();
    // Percentages are of what is SHOWN: hiding a category re-bases the rest,
    // which is the point of hiding it (the review asked to drop a dominant
    // slice to read the others).
    const total = useMemo(
      () => slices.reduce((sum, s) => (excludedKeys?.has(s.key) ? sum : sum + s.value), 0),
      [slices, excludedKeys],
    );
    const sorted = useMemo(() => [...slices].sort((a, b) => b.value - a.value), [slices]);

    const handlePress = useCallback(
      (slice: Label) => {
        if (onCategoryPress && slice.categoryId) {
          onCategoryPress(slice.categoryId);
        }
      },
      [onCategoryPress],
    );

    const isTappable = !!onCategoryPress;

    return (
      <View style={gs.mt20}>
        {sorted.map(slice => {
          const excluded = excludedKeys?.has(slice.key) ?? false;
          const pct = !excluded && total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const isActive = activeKey === slice.key;
          const budget = slice.categoryId ? categoryBudgets?.[slice.categoryId] : undefined;
          const budgetRatio = budget ? slice.value / budget.amount : 0;
          const overBudget = !!budget && slice.value > budget.amount;
          const content = (
            <View
              style={[
                gs.rounded12,
                gs.mb6,
                gs.px14,
                gs.py10,
                styles.row,
                excluded ? styles.excluded : undefined,
                // Mirrors the chart's selection so the two read as one control.
                {backgroundColor: colors.secondaryAccent, borderColor: isActive ? slice.color : TRANSPARENT},
              ]}>
              <View style={[gs.rowCenter, gs.gap8]}>
                <View style={[gs.size10, gs.roundedFull, {backgroundColor: slice.color}]} />
                <PrimaryText size={13} color={colors.primaryText} numberOfLines={1} style={gs.flex1}>
                  {slice.label}
                </PrimaryText>
                <Amount size={13} weight="semibold" color={colors.primaryText}>
                  {formatAmount(slice.value)}
                </Amount>
                <View
                  style={[gs.px5, gs.py3, gs.rounded5, styles.pct, {backgroundColor: hexToRgba(slice.color, 0.125)}]}>
                  <PrimaryText size={11} weight="semibold" variant="number" color={slice.color}>
                    {excluded ? '–' : formatPercent(pct)}
                  </PrimaryText>
                </View>
                {onToggleExclude ? (
                  <TouchableOpacity
                    onPress={() => onToggleExclude(slice.key)}
                    hitSlop={EYE_HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityState={{selected: !excluded}}
                    accessibilityLabel={
                      excluded
                        ? t('reports.showCategory', {name: slice.label})
                        : t('reports.hideCategory', {name: slice.label})
                    }>
                    <Icon name={excluded ? 'eye-off' : 'eye'} size={15} color={colors.secondaryText} />
                  </TouchableOpacity>
                ) : null}
                {isTappable && <Icon name="chevron-right" size={14} color={colors.secondaryText} />}
              </View>
              {budget ? (
                <View style={gs.mt8}>
                  <View style={[gs.rounded4, gs.h4, {backgroundColor: colors.secondaryContainerColor}]}>
                    <View
                      style={[
                        gs.rounded4,
                        gs.h4,
                        {
                          width: `${Math.min(budgetRatio * 100, 100)}%`,
                          backgroundColor: overBudget ? colors.accentOrange : slice.color,
                        },
                      ]}
                    />
                  </View>
                  <Amount
                    weight="medium"
                    size={10}
                    color={overBudget ? colors.accentOrange : colors.secondaryText}
                    style={gs.mt3}>
                    {t('reports.categoryBudgetLine', {
                      spent: formatAmount(slice.value),
                      budget: formatAmount(budget.amount),
                    })}
                  </Amount>
                </View>
              ) : null}
            </View>
          );

          if (isTappable) {
            const toggleLabel = excluded
              ? t('reports.showCategory', {name: slice.label})
              : t('reports.hideCategory', {name: slice.label});
            return (
              <TouchableOpacity
                key={slice.key}
                onPress={() => handlePress(slice)}
                accessibilityRole="button"
                accessibilityHint={t('reports.openCategoryHint')}
                // One element for a screen reader, which reaches nothing inside it: so the
                // row says its figures, and the eye is its action. VoiceOver could not hide
                // a category from the chart (found on the iPhone, 2026-11-09).
                accessibilityLabel={[
                  slice.label,
                  formatAmount(slice.value),
                  excluded ? '' : formatPercent(pct),
                  budget
                    ? t('reports.categoryBudgetLine', {
                        spent: formatAmount(slice.value),
                        budget: formatAmount(budget.amount),
                      })
                    : '',
                ]
                  .filter(Boolean)
                  .join(', ')}
                accessibilityActions={onToggleExclude ? [{name: 'toggle', label: toggleLabel}] : undefined}
                onAccessibilityAction={event => {
                  if (event.nativeEvent.actionName === 'toggle') {
                    onToggleExclude?.(slice.key);
                  }
                }}
                activeOpacity={0.7}>
                {content}
              </TouchableOpacity>
            );
          }

          return <View key={slice.key}>{content}</View>;
        })}
      </View>
    );
  },
);

/** The eye is 15 dp: the shared 14 dp slop made it 43, one short of 44 (audit 2026-11-08 §9). */
const EYE_HIT_SLOP = {top: 15, bottom: 15, left: 15, right: 15};

const styles = StyleSheet.create({
  row: {borderWidth: 1},
  // 0.65 keeps a hidden row's text at 4.5:1 (M31: 0.45 was 2.74).
  excluded: {opacity: 0.65},
  pct: {minWidth: 40, alignItems: 'center'},
});
