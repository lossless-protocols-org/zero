import {TouchableOpacity, View, StyleSheet} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps, ScrollView} from 'react-native-actions-sheet';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryText from '../components/atoms/PrimaryText';
import PrimaryButton from '../components/atoms/PrimaryButton';
import {getMonthNamesShort, getCurrentYear} from '../utils/dateUtils';
import {gs} from '../styles/globalStyles';

const MonthYearPickerSheet: React.FC<SheetProps<'month-year-picker-sheet'>> = React.memo(props => {
  const {t, i18n} = useTranslation();
  const colors = useThemeColors();
  const {selectedMonth, selectedYear, availableYears, onSelect} = props.payload ?? {};

  // Computed per render, not at module load: month names must follow a runtime
  // language change, and a cached "current year" goes stale on New Year's Eve.
  // getMonthNamesShort() reads dayjs's active locale, which the lint rule
  // cannot see — i18n.language is the signal that it changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthsShort = useMemo(() => getMonthNamesShort(), [i18n.language]);
  const currentYear = getCurrentYear();

  const [pickerYear, setPickerYear] = useState(selectedYear ?? currentYear);
  const [pickerMonthIndex, setPickerMonthIndex] = useState(selectedMonth ?? 0);

  const years = availableYears && availableYears.length > 0 ? availableYears : [currentYear];

  const handleConfirm = useCallback(() => {
    onSelect?.(pickerMonthIndex, pickerYear);
    void SheetManager.hide(props.sheetId);
  }, [onSelect, pickerMonthIndex, pickerYear, props.sheetId]);

  const isMonthDisabled = useCallback(
    (monthIndex: number) => {
      if (pickerYear < currentYear) {
        return false;
      }
      if (pickerYear > currentYear) {
        return true;
      }
      return monthIndex > new Date().getMonth();
    },
    [pickerYear, currentYear],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectMonthYear'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px16, gs.pb10, gs.pt5]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={gs.mb15}>
          <View style={[gs.rowCenter, gs.gap6]}>
            {years.map(year => (
              <TouchableOpacity key={year} onPress={() => setPickerYear(year)}>
                <View
                  style={[
                    gs.px12,
                    gs.py8,
                    gs.minTouch,
                    gs.rounded8,
                    {
                      backgroundColor: year === pickerYear ? colors.accentGreen : colors.secondaryAccent,
                    },
                  ]}>
                  <PrimaryText
                    size={13}
                    weight={year === pickerYear ? 'semibold' : 'regular'}
                    color={year === pickerYear ? colors.buttonText : colors.primaryText}
                    variant="number">
                    {year}
                  </PrimaryText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[gs.row, gs.wrap, gs.gap8, gs.mb15]}>
          {monthsShort.map((month, index) => {
            const isActive = index === pickerMonthIndex;
            const disabled = isMonthDisabled(index);

            return (
              <TouchableOpacity
                key={month}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{selected: isActive, disabled}}
                accessibilityLabel={month}
                onPress={() => setPickerMonthIndex(index)}
                style={[
                  gs.py10,
                  gs.rounded8,
                  gs.center,
                  styles.cell,
                  disabled ? gs.dimmed : undefined,
                  {backgroundColor: isActive ? colors.accentGreen : colors.secondaryAccent},
                ]}>
                <PrimaryText
                  size={13}
                  weight={isActive ? 'semibold' : 'regular'}
                  color={isActive ? colors.buttonText : colors.primaryText}>
                  {month}
                </PrimaryText>
              </TouchableOpacity>
            );
          })}
        </View>

        <PrimaryButton onPress={handleConfirm} colors={colors} buttonTitle={t('common.done')} />
      </View>
    </CustomBottomSheet>
  );
});

export default MonthYearPickerSheet;

const styles = StyleSheet.create({
  cell: {width: '22.5%'},
});
