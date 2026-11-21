import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {CustomBottomSheet} from '../../../ui/atoms/CustomBottomSheet';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {MAX_MONTH_START_DAY, periodFor, periodKeyOf, toMonthStartDay} from '../../../domain/period';
import {formatMonthLabel} from '../../../platform/dateFormat';
import {gs} from '../../../ui/globalStyles';

const DAYS = Array.from({length: MAX_MONTH_START_DAY}, (_, index) => index + 1);
const WEEKS = Array.from({length: DAYS.length / 7}, (_, week) => DAYS.slice(week * 7, week * 7 + 7));

/**
 * The day the user's month starts on (3.0 Pro, plan P11): 1 to 28, as four
 * rows of seven. Under the grid, the month it is now with the picked day, so
 * the choice is seen before it is applied ("This month: 7 Nov – 6 Dec").
 */
export const MonthStartPickerSheet: React.FC<SheetProps<'month-start-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [selected, setSelected] = useState(toMonthStartDay(props.payload?.current));

  const handleConfirm = useCallback(() => {
    props.payload?.onSelect?.(selected);
    void SheetManager.hide(props.sheetId);
  }, [props, selected]);

  const preview = formatMonthLabel(periodFor(periodKeyOf(new Date(), selected), selected));

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('settings.monthStart'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        <PrimaryText size={13} color={colors.secondaryText} style={gs.mb10}>
          {t('settings.monthStartHint')}
        </PrimaryText>
        {/* The result first: what the choice makes of this month, before the choice itself. */}
        <View
          accessibilityLiveRegion="polite"
          style={[gs.px14, gs.py12, gs.rounded12, gs.mb15, {backgroundColor: colors.primaryBackground}]}>
          <PrimaryText size={15} weight="semibold">
            {t('settings.monthStartPreview', {month: preview})}
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
            {t('settings.monthStartCovers')}
          </PrimaryText>
        </View>
        <View style={gs.gap6} accessibilityRole="radiogroup">
          {WEEKS.map(week => (
            <View key={week[0]} style={[gs.row, gs.gap6]}>
              {week.map(day => {
                const picked = day === selected;
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelected(day)}
                    activeOpacity={0.6}
                    accessibilityRole="radio"
                    accessibilityLabel={t('settings.monthStartDay', {day})}
                    accessibilityState={{checked: picked}}
                    style={[
                      gs.flex1,
                      gs.minTouch,
                      gs.center,
                      gs.rounded8,
                      // Lighter than the sheet, so each day reads as a tile to tap (they had no visible edge).
                      {backgroundColor: picked ? colors.primaryText : colors.primaryBackground},
                    ]}>
                    <PrimaryText
                      size={14}
                      weight={picked ? 'semibold' : 'regular'}
                      color={picked ? colors.buttonText : colors.primaryText}
                      variant="number">
                      {day}
                    </PrimaryText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
        <PrimaryText size={11} color={colors.secondaryText} style={gs.mt10}>
          {t('settings.monthStartWhy')}
        </PrimaryText>
        <View style={gs.mt15}>
          <PrimaryButton
            onPress={handleConfirm}
            colors={colors}
            buttonTitle={t('settings.monthStartApply', {day: selected})}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});
