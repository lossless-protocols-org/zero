import React, {useCallback, useState} from 'react';
import {StyleSheet, TouchableOpacity, View, type LayoutChangeEvent} from 'react-native';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs} from '../../../ui/globalStyles';

interface TrendColumnsProps {
  /**
   * One column per month, oldest first. `spent`, `kept` and `over` are shares
   * (0 to 1) of the chart's height (domain/trends.trendColumns).
   */
  columns: ReadonlyArray<{
    key: string;
    label: string;
    spoken: string;
    spent: number;
    kept: number;
    over: number;
  }>;
  selectedKey: string | null;
  /** The month still in progress, drawn paler: it is not a whole month yet. */
  runningKey: string | null;
  /** The usual spending as a share of the chart's height; null for no line. */
  usual: number | null;
  onSelect: (key: string) => void;
}

/** @internal The tests read the drawn heights against it. */
export const TREND_CHART_HEIGHT = 140;
/** The outline around the selected column: its border and the space inside it, on every side. */
const FRAME = 3;
/** The space between the stacked parts of a column. */
const PART_GAP = 2;
/** A part that is more than nothing is never thinner than this. */
const MIN_PART = 2;
const DASH_WIDTH = 4;
const DASH_GAP = 3;

/** The drawn height of a part, and of the gap under it when it sits on another part. */
const partHeight = (share: number, onAnother: boolean): number =>
  Math.max(share * TREND_CHART_HEIGHT - (onAnother ? PART_GAP : 0), MIN_PART);

/**
 * The months as columns (Trends redesign), drawn with plain views. A column is
 * as tall as the money that came in: spent from the bottom, kept on top of it,
 * so the two differ by position as well as colour. A month that spent more
 * than came in is all spent, with a cap for the excess. A dashed line marks
 * the usual spending. Each column is a button that says its month and
 * figures; tapping one selects it for the figures above the chart.
 */
export const TrendColumns: React.FC<TrendColumnsProps> = ({columns, selectedKey, runningKey, usual, onSelect}) => {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  // Twelve columns leave no room for twelve names: every other one is labelled.
  const everyOther = columns.length > 6;

  return (
    <View>
      <View style={[gs.row, styles.chart]} onLayout={onLayout}>
        {columns.map(column => {
          const selected = column.key === selectedKey;
          return (
            <TouchableOpacity
              key={column.key}
              onPress={() => onSelect(column.key)}
              accessibilityRole="button"
              accessibilityLabel={column.spoken}
              accessibilityState={{selected}}
              activeOpacity={0.7}
              style={[gs.flex1, gs.itemsCenter, gs.justifyEnd]}>
              <View
                testID={`trend-column-${column.key}`}
                style={[
                  styles.frame,
                  column.key === runningKey && styles.running,
                  // Always there, so a column does not move when it is selected.
                  selected ? {borderColor: colors.primaryText} : styles.frameIdle,
                ]}>
                {column.over > 0 ? (
                  <View
                    testID={`trend-over-${column.key}`}
                    style={[
                      styles.part,
                      styles.onAnother,
                      {height: partHeight(column.over, true), backgroundColor: colors.accentRed},
                    ]}
                  />
                ) : null}
                {column.kept > 0 ? (
                  <View
                    testID={`trend-kept-${column.key}`}
                    style={[
                      styles.part,
                      column.spent > 0 && styles.onAnother,
                      {height: partHeight(column.kept, column.spent > 0), backgroundColor: colors.accentGreen},
                    ]}
                  />
                ) : null}
                {column.spent > 0 ? (
                  <View
                    testID={`trend-spent-${column.key}`}
                    style={[
                      styles.part,
                      {height: partHeight(column.spent, false), backgroundColor: colors.secondaryText},
                    ]}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {usual === null ? null : (
          <View
            testID="trend-usual-line"
            style={[gs.row, gs.overflowHidden, styles.usual, {bottom: FRAME + usual * TREND_CHART_HEIGHT}]}>
            {Array.from({length: Math.ceil(width / (DASH_WIDTH + DASH_GAP))}, (_, index) => (
              <View key={index} style={[styles.dash, {backgroundColor: colors.primaryText}]} />
            ))}
          </View>
        )}
      </View>
      {/* The names under the columns repeat what each column already says to a screen reader. */}
      <View style={[gs.row, gs.mt5]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {columns.map((column, index) => (
          <View key={column.key} style={[gs.flex1, gs.itemsCenter]}>
            {!everyOther || (columns.length - 1 - index) % 2 === 0 ? (
              <PrimaryText
                size={10}
                color={column.key === selectedKey ? colors.primaryText : colors.secondaryText}
                weight={column.key === selectedKey ? 'bold' : 'regular'}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}>
                {column.label}
              </PrimaryText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chart: {height: TREND_CHART_HEIGHT + 2 * FRAME},
  frame: {width: '70%', minHeight: 2 * FRAME + MIN_PART, padding: FRAME - 1.5, borderWidth: 1.5, borderRadius: 5},
  frameIdle: {borderColor: 'transparent'},
  running: {opacity: 0.55},
  part: {width: '100%', borderRadius: 2},
  onAnother: {marginBottom: PART_GAP},
  usual: {position: 'absolute', start: 0, end: 0, height: 1, gap: DASH_GAP, pointerEvents: 'none'},
  dash: {width: DASH_WIDTH, height: 1},
});
