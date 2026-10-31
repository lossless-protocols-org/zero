import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryText from '../components/atoms/PrimaryText';
import PrimaryButton from '../components/atoms/PrimaryButton';
import {getWeekdayNames} from '../utils/dateUtils';
import type {WeekStartDay} from '../utils/weekStart';
import {gs} from '../styles/globalStyles';

const OPTIONS: WeekStartDay[] = ['sunday', 'monday'];

/** Localized full weekday name for an option, straight from dayjs. */
const optionLabel = (option: WeekStartDay): string => {
  const names = getWeekdayNames(); // Sunday-first
  return names[option === 'sunday' ? 0 : 1] ?? option;
};

const WeekStartPickerSheet: React.FC<SheetProps<'week-start-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<WeekStartDay>(props.payload?.current === 'monday' ? 'monday' : 'sunday');

  const handleConfirm = useCallback(() => {
    props.payload?.onSelect?.(selected);
    void SheetManager.hide(props.sheetId);
  }, [props, selected]);

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectWeekStart'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {OPTIONS.map(option => (
          <TouchableOpacity
            key={option}
            onPress={() => setSelected(option)}
            activeOpacity={0.6}
            accessibilityRole="radio"
            accessibilityState={{checked: selected === option}}>
            <View style={[gs.rowBetweenCenter, gs.py12]}>
              <PrimaryText size={15} weight={selected === option ? 'semibold' : 'medium'}>
                {optionLabel(option)}
              </PrimaryText>
              <View
                style={[
                  gs.size20,
                  gs.rounded10,
                  gs.border2,
                  gs.center,
                  {borderColor: selected === option ? colors.accentGreen : colors.secondaryText},
                ]}>
                {selected === option && (
                  <View style={[gs.size10, gs.rounded5, {backgroundColor: colors.accentGreen}]} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={gs.mt10}>
          <PrimaryButton onPress={handleConfirm} colors={colors} buttonTitle={t('common.apply')} />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

export default WeekStartPickerSheet;
