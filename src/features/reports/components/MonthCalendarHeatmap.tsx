import React, {useMemo} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {firstWeekdayOfMonth, isIsoDay, toDayKey, toYearMonth} from '../../../domain/dates';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {fromMoneyUnits, toMoneyUnits} from '../../../domain/money';
import {useFormatSpend} from '../../../ui/hooks/useFormatSpend';
import {hexToRgba} from '../../../ui/colorUtils';
import {leadingBlanks, type WeekStartDay} from '../../../platform/weekStart';
import {navigate} from '../../../platform/navigationUtils';
import {gs} from '../../../ui/globalStyles';

interface MonthCalendarHeatmapProps {
  /** Signed spend rows: refunds are negative (domain/periodMath.toSpendRows). */
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
  const formatSpend = useFormatSpend();

  // Each day's net in exact money units, and the busiest day from the FINAL totals: a running
  // max kept a day's pre-refund peak when its refund came later in the list (audit 2026-11-08).
  const {totalsByDay, maxDayAmount} = useMemo(() => {
    const units = new Map<string, number>();
    for (const transaction of transactions) {
      const dateKey = toDayKey(transaction.date);
      units.set(dateKey, (units.get(dateKey) ?? 0) + toMoneyUnits(transaction.amount));
    }
    const byDay = new Map<string, number>([...units].map(([day, u]) => [day, fromMoneyUnits(u)]));
    const maxAmount = Math.max(0, ...byDay.values());
    return {totalsByDay: byDay, maxDayAmount: maxAmount};
  }, [transactions]);

  const yearMonth = toYearMonth(year, monthIndex);

  // Each day's key, label and colours, once per month, data, theme and
  // language: they were computed for every cell on every render, a dayjs
  // format and a colour parse each (audit 2026-11-08 §8.3).
  const days = useMemo(() => {
    const shadeOf = (amount: number): string => {
      const ratio = maxDayAmount > 0 ? amount / maxDayAmount : 0;
      const opacity = ratio >= 0.75 ? 1 : ratio >= 0.5 ? 0.75 : ratio >= 0.25 ? 0.5 : 0.3;
      return hexToRgba(colors.accentGreen, opacity);
    };
    return Array.from({length: daysInMonth}, (_, i) => {
      const dateKey = `${yearMonth}-${String(i + 1).padStart(2, '0')}`;
      const total = totalsByDay.get(dateKey);
      const hasTransactions = total !== undefined;
      // A day whose refunds outweigh its spending (signed rows) shades as no spend.
      const shaded = hasTransactions && total > 0;
      const date = formatDisplayDate(dateKey, 'date');
      return {
        dateKey,
        hasTransactions,
        shaded,
        // VoiceOver read a bare "5" with no role (2.7.1 iOS pass): the date, and the day's spend when there is one.
        label: hasTransactions ? t('common.fieldValue', {field: date, value: formatSpend(total).text}) : date,
        background: shaded ? shadeOf(total) : colors.secondaryAccent,
        border: hasTransactions ? colors.accentGreen : colors.secondaryContainerColor,
      };
    });
    // `t` is also the language signal for formatDisplayDate's month names.
  }, [daysInMonth, yearMonth, totalsByDay, maxDayAmount, colors, formatSpend, t]);
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
              const cell = days[day - 1];
              if (!cell) {
                return null; // `day` runs 1…daysInMonth, the length of `days`
              }
              return (
                <TouchableOpacity
                  key={cell.dateKey}
                  accessibilityRole="button"
                  accessibilityLabel={cell.label}
                  hitSlop={DAY_HIT_SLOP}
                  style={[
                    styles.day,
                    gs.center,
                    gs.rounded8,
                    gs.border1,
                    styles.cell,
                    {backgroundColor: cell.background, borderColor: cell.border},
                  ]}
                  onPress={() => {
                    if (isIsoDay(cell.dateKey)) {
                      navigate('EverydayTransactionScreen', {isDate: cell.dateKey});
                    }
                  }}>
                  <PrimaryText
                    size={12}
                    weight={cell.hasTransactions ? 'semibold' : 'regular'}
                    color={cell.shaded ? colors.buttonText : colors.primaryText}
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
