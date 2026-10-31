import React, {useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {displayCategoryName} from '../../i18n/displayNames';
import DonutChart from '../atoms/DonutChart';
import PieChartLabels from '../atoms/PieChartLabels';
import useThemeColors from '../../hooks/useThemeColors';
import useFormatAmount from '../../hooks/useFormatAmount';
import {navigate} from '../../utils/navigationUtils';
import type {ExpenseWithCategory} from '../../watermelondb/services';

/** Slice key for expenses whose category row is missing. */
const UNCATEGORISED_KEY = '__uncategorised__';

/** Fallback slice color for expenses whose category record has no color. */
const DEFAULT_SLICE_COLOR = '#758595';

interface CategoryDonutProps {
  transactions: readonly ExpenseWithCategory[];
  categoryBudgets: Readonly<Record<string, {amount: number}>>;
  /** YYYY-MM, for the category drill-down. */
  yearMonth: string;
}

/** Spend per category as a donut with a legend; slices can be hidden and opened. */
export const CategoryDonut: React.FC<CategoryDonutProps> = ({transactions, categoryBudgets, yearMonth}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();

  // Selection lives here so the ring and the legend stay in step.
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  // Categories hidden from the chart (review: "the ability to turn off certain
  // categories"). Screen-local and per visit: a hidden slice is a reading aid,
  // not a preference, so it is not persisted.
  const [excludedKeys, setExcludedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExcluded = useCallback((key: string) => {
    setExcludedKeys(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setActiveSlice(current => (current === key ? null : current));
  }, []);

  const pieChartData = useMemo(() => {
    const categoryMap = new Map<string, {name: string; color: string; id?: string; icon?: string; amount: number}>();

    transactions.forEach(({amount, category}) => {
      const categoryName = category?.name ? displayCategoryName(category.name, t) : t('common.unknown');
      // Grouped by id, not by the shown name: a translated seed name and a
      // category the user typed with the same word must stay two slices (M32).
      const sliceKey = category?.id ?? UNCATEGORISED_KEY;

      const existing = categoryMap.get(sliceKey);
      if (existing) {
        existing.amount += amount;
      } else {
        // Spread first so the fallbacks below actually win over null/undefined
        // fields on the category record.
        categoryMap.set(sliceKey, {
          ...category,
          name: categoryName,
          color: category?.color ?? DEFAULT_SLICE_COLOR,
          amount,
        });
      }
    });

    return Array.from(categoryMap.entries()).map(([key, item]) => ({
      key,
      label: item.name,
      value: item.amount,
      color: item.color,
      categoryId: item.id,
      categoryIcon: item.icon,
    }));
  }, [transactions, t]);

  const visibleSlices = useMemo(
    () => pieChartData.filter(slice => !excludedKeys.has(slice.key)),
    [pieChartData, excludedKeys],
  );

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      navigate('CategoryTransactionScreen', {categoryId, yearMonth});
    },
    [yearMonth],
  );

  return (
    <View>
      <DonutChart
        data={visibleSlices}
        colors={colors}
        formatValue={formatAmount}
        onSelectionChange={setActiveSlice}
        accessibilityLabel={t('reports.title')}
      />
      <PieChartLabels
        slices={pieChartData}
        colors={colors}
        activeKey={activeSlice}
        excludedKeys={excludedKeys}
        onToggleExclude={toggleExcluded}
        categoryBudgets={categoryBudgets}
        onCategoryPress={handleCategoryPress}
      />
    </View>
  );
};
