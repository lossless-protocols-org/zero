import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {ListSection} from '../../../ui/molecules/ListSection';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs} from '../../../ui/globalStyles';

interface TrendCategoryRowsProps {
  title: string;
  /** Beside the title: the stretch the small charts cover ("6 months"). */
  trailing: string;
  rows: ReadonlyArray<{
    id: string;
    name: string;
    /** The category's spending in each month shown, oldest first. */
    series: readonly number[];
    /** The selected month's amount, formatted. */
    amount: string;
    /** Against the month before ("▲ 42%"); null when there is nothing to say. */
    change: string | null;
    spoken: string;
  }>;
  /** The category shown in the big chart, if any. */
  selectedId: string | null;
  /** What tapping a row does, for a screen reader. */
  hint: string;
  onPress: (id: string) => void;
}

const SPARK_HEIGHT = 16;

/**
 * The categories that matter in the months shown (Trends redesign): each with
 * a small chart of its months, the selected month's amount and its change.
 * Tapping a row shows that category in the big chart; again, all spending.
 */
export const TrendCategoryRows: React.FC<TrendCategoryRowsProps> = ({
  title,
  trailing,
  rows,
  selectedId,
  hint,
  onPress,
}) => {
  const colors = useThemeColors();
  return (
    <ListSection title={title} trailing={trailing}>
      {rows.map(row => {
        const selected = row.id === selectedId;
        const top = Math.max(0, ...row.series);
        return (
          <TouchableOpacity
            key={row.id}
            onPress={() => onPress(row.id)}
            accessibilityRole="button"
            accessibilityLabel={row.spoken}
            accessibilityHint={hint}
            accessibilityState={{selected}}
            activeOpacity={0.7}
            style={[
              gs.rowBetweenCenter,
              gs.gap10,
              gs.px16,
              gs.py10,
              gs.minTouch,
              selected && {backgroundColor: colors.secondaryAccent},
            ]}>
            <PrimaryText size={13} weight={selected ? 'bold' : 'medium'} numberOfLines={1} style={gs.flex1}>
              {row.name}
            </PrimaryText>
            <View style={[gs.row, gs.itemsEnd, gs.gap2, styles.spark]}>
              {row.series.map((value, index) => {
                const height = top > 0 && value > 0 ? Math.max((value / top) * SPARK_HEIGHT, 2) : 1;
                // The last bar is the newest month: the one the eye should land on.
                const backgroundColor = index === row.series.length - 1 ? colors.primaryText : colors.secondaryText;
                return <View key={index} style={[styles.sparkBar, {height, backgroundColor}]} />;
              })}
            </View>
            <View style={[gs.itemsEnd, styles.figures]}>
              <Amount size={13} weight="medium">
                {row.amount}
              </Amount>
              {row.change === null ? null : (
                <PrimaryText size={11} variant="number" color={colors.secondaryText} numberOfLines={1}>
                  {row.change}
                </PrimaryText>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ListSection>
  );
};

const styles = StyleSheet.create({
  spark: {height: SPARK_HEIGHT},
  sparkBar: {width: 3, borderRadius: 1},
  figures: {minWidth: 72, flexShrink: 1},
});
