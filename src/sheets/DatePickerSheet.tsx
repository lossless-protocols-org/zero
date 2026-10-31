import {Platform, TouchableOpacity, View, StyleSheet} from 'react-native';
import React, {useState, useCallback, memo} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import DateTimePicker, {DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import useThemeColors from '../hooks/useThemeColors';
import PrimaryText from '../components/atoms/PrimaryText';
import {gs} from '../styles/globalStyles';

const DatePickerSheet: React.FC<SheetProps<'date-picker-sheet'>> = props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const initialDate = props.payload?.selectedDate ? new Date(props.payload.selectedDate) : new Date();
  const [tempDate, setTempDate] = useState(initialDate);

  const minDate = props.payload?.minDate;
  const maxDate = props.payload?.maxDate;

  const handleDateChange = useCallback((_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    props.payload?.onSelect?.(tempDate);
    void SheetManager.hide(props.sheetId);
  }, [props.payload, props.sheetId, tempDate]);

  const handleCancel = useCallback(() => {
    void SheetManager.hide(props.sheetId);
  }, [props.sheetId]);

  return (
    <CustomBottomSheet sheetId={props.sheetId} header={null} showIndicator={true} gestureEnabled>
      <View style={gs.pb20}>
        <View style={[gs.rowBetween, gs.itemsCenter, gs.px20, gs.py10]}>
          {/* 44 pt targets (M30); the title gives the sheet a heading (M29). */}
          <TouchableOpacity onPress={handleCancel} style={styles.action} accessibilityRole="button">
            <PrimaryText color={colors.accentRed}>{t('common.cancel')}</PrimaryText>
          </TouchableOpacity>
          <PrimaryText weight="semibold" accessibilityRole="header">
            {t('sheets.selectDate')}
          </PrimaryText>
          <TouchableOpacity onPress={handleConfirm} style={styles.action} accessibilityRole="button">
            <PrimaryText color={colors.accentGreen}>{t('common.done')}</PrimaryText>
          </TouchableOpacity>
        </View>

        <View style={gs.center}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={minDate}
            maximumDate={maxDate}
            style={[gs.h200, gs.wFull]}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
};

export default memo(DatePickerSheet);

const styles = StyleSheet.create({
  action: {minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 5},
});
