import React, {useMemo} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryText from '../atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {firstWeekdayOfMonth, formatDate, formatDisplayDate, isIsoDay, toYearMonth} from '../../utils/dateUtils';
import useFormatAmount from '../../hooks/useFormatAmount';
import {hexToRgba} from '../../utils/colorUtils';
import {leadingBlanks, type WeekStartDay} from '../../utils/weekStart';
import {navigate} from '../../utils/navigationUtils';
import {gs} from '../../styles/globalStyles';

interface MonthCalendarHeatmapProps {
  transactions: ReadonlyArray<{date: string; amount: number}>;
  year: number;
  /** 0-based, as the month selection stores it. */
  monthIndex: number;
  daysInMonth: number;
  /** Weekday headers, already rotated to `weekStart`. */
  dayNames: readonly string[];
  weekStart: WeekStartDay;
}

const LEGEND_OPACITIES = [0.1, 0.3, 0.5, 0.75, 1];

/** The month as a grid shaded by each day's spend; a day opens its transactions. */
export const MonthCalendarHeatmap: React.FC<MonthCalendarHeatmapProps> = ({
  transactions,
  year,
  monthIndex,
  daysInMonth,
  dayNames,
  weekStart,
}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const formatAmount = useFormatAmount();

  const {totalsByDay, maxDayAmount} = useMemo(() => {
    const byDay = new Map<string, number>();
    let maxAmount = 0;
    for (const transaction of transactions) {
      const dateKey = formatDate(transaction.date, 'YYYY-MM-DD');
      const total = (byDay.get(dateKey) ?? 0) + transaction.amount;
      byDay.set(dateKey, total);
      maxAmount = Math.max(maxAmount, total);
    }
    return {totalsByDay: byDay, maxDayAmount: maxAmount};
  }, [transactions]);

  const heatmapColor = (amount: number, hasTransactions: boolean): string => {
    if (!hasTransactions || amount === 0) {
      return colors.secondaryAccent;
    }
    const ratio = maxDayAmount > 0 ? amount / maxDayAmount : 0;
    if (ratio >= 0.75) {
      return hexToRgba(colors.accentGreen, 1);
    } else if (ratio >= 0.5) {
      return hexToRgba(colors.accentGreen, 0.75);
    } else if (ratio >= 0.25) {
      return hexToRgba(colors.accentGreen, 0.5);
    }
    return hexToRgba(colors.accentGreen, 0.3);
  };

  const yearMonth = toYearMonth(year, monthIndex);
  // Shifted by the week-start preference so day 1 lands under its header.
  const blanks = leadingBlanks(firstWeekdayOfMonth(year, monthIndex), weekStart);

  // Leading blanks, the days, then blanks to finish the last week: every row
  // holds exactly seven equal columns, so the grid fills any screen width.
  const cells: Array<number | null> = [
    ...Array.from({length: blanks}, () => null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks = Array.from({length: cells.length / 7}, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <>
      <View style={[gs.mt15, styles.grid]}>
        <View style={styles.week}>
          {dayNames.map((day, index) => (
            <View key={`${day}-${index}`} style={[gs.center, styles.cell, styles.header]}>
              {/* Capped: at the largest text the names ran together ("SunMonTue"). */}
              <PrimaryText size={13} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
                {day}
              </PrimaryText>
            </View>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={`week-${w}`} testID="calendar-week" style={styles.week}>
            {week.map((day, i) => {
              if (day === null) {
                const leading = w === 0;
                return (
                  <View
                    key={`${leading ? 'blank' : 'pad'}-${i}`}
                    testID={leading ? 'calendar-blank' : 'calendar-pad'}
                    style={[gs.border1, styles.cell, styles.blank]}
                  />
                );
              }
              const dateKey = `${yearMonth}-${String(day).padStart(2, '0')}`;
              const total = totalsByDay.get(dateKey);
              const hasTransactions = total !== undefined;
              return (
                <TouchableOpacity
                  key={dateKey}
                  // VoiceOver read a bare "5" with no role (2.7.1 iOS pass): the
                  // date, and the day's spend when there is one.
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasTransactions
                      ? `${formatDisplayDate(dateKey, 'date')}, ${formatAmount(total)}`
                      : formatDisplayDate(dateKey, 'date')
                  }
                  hitSlop={DAY_HIT_SLOP}
                  style={[
                    styles.day,
                    gs.center,
                    gs.rounded8,
                    gs.border1,
                    styles.cell,
                    {
                      backgroundColor: heatmapColor(total ?? 0, hasTransactions),
                      borderColor: hasTransactions ? colors.accentGreen : colors.secondaryContainerColor,
                    },
                  ]}
                  onPress={() => {
                    const isDate = formatDate(new Date(year, monthIndex, day), 'YYYY-MM-DD');
                    if (isIsoDay(isDate)) {
                      navigate('EverydayTransactionScreen', {isDate});
                    }
                  }}>
                  <PrimaryText
                    size={12}
                    weight={hasTransactions ? 'semibold' : 'regular'}
                    color={hasTransactions ? colors.buttonText : colors.primaryText}
                    variant="number">
                    {day}
                  </PrimaryText>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={[gs.rowCenter, gs.justifyCenter, gs.mt10, gs.mb10, gs.gap4]}>
        <PrimaryText size={11} color={colors.secondaryText}>
          {t('reports.less')}
        </PrimaryText>
        {LEGEND_OPACITIES.map(opacity => (
          <View
            key={`legend-${opacity}`}
            style={[
              gs.size16,
              gs.rounded3,
              gs.border1,
              {backgroundColor: hexToRgba(colors.accentGreen, opacity), borderColor: colors.secondaryContainerColor},
            ]}
          />
        ))}
        <PrimaryText size={11} color={colors.secondaryText}>
          {t('reports.more')}
        </PrimaryText>
      </View>
    </>
  );
};

const CELL_GAP = 4;
// Days are drawn 36 pt tall (a 44 pt grid made the month tall); the slop keeps
// a 44 pt target (M30) and stays inside the 4 pt gap to the next week.
const DAY_HEIGHT = 36;
const DAY_HIT_SLOP = {top: 4, bottom: 4};

const styles = StyleSheet.create({
  grid: {gap: CELL_GAP},
  week: {flexDirection: 'row', gap: CELL_GAP},
  // Equal shares of the row, whatever the phone's width (was a fixed 13.5%,
  // which left a different gap at the right edge on every screen).
  cell: {flex: 1},
  day: {height: DAY_HEIGHT},
  // Same 1 pt border as a day, invisible: Yoga counts a border in a flex
  // item's minimum basis, so a borderless blank shifted the first week's
  // columns by up to 3.7 pt against the rest (measured on an iPhone 16).
  blank: {borderColor: 'transparent'},
  header: {minHeight: 28},
});
