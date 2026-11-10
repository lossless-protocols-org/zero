import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {CustomBottomSheet} from '../../../ui/atoms/CustomBottomSheet';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {gs} from '../../../ui/globalStyles';
import type {ThemeMode} from '../../../ui/context/ThemeContext';

const THEMES = ['light', 'dark', 'system'] as const;

export const ThemePickerSheet: React.FC<SheetProps<'theme-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<ThemeMode>(props.payload?.currentTheme ?? 'system');

  const handleConfirm = useCallback(() => {
    props.payload?.onSelect?.(selected);
    void SheetManager.hide(props.sheetId);
  }, [props, selected]);

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectTheme'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {THEMES.map(theme => (
          <TouchableOpacity
            key={theme}
            onPress={() => setSelected(theme)}
            activeOpacity={0.6}
            accessibilityRole="radio"
            accessibilityState={{checked: selected === theme}}>
            <View style={[gs.rowBetweenCenter, gs.py12]}>
              <PrimaryText size={15} weight={selected === theme ? 'semibold' : 'medium'}>
                {theme === 'light'
                  ? t('settings.themeLight')
                  : theme === 'dark'
                    ? t('settings.themeDark')
                    : t('settings.themeSystem')}
              </PrimaryText>
              <View
                style={[
                  gs.size20,
                  gs.rounded10,
                  gs.border2,
                  gs.center,
                  {borderColor: selected === theme ? colors.accentGreen : colors.secondaryText},
                ]}>
                {selected === theme && <View style={[gs.size10, gs.rounded5, {backgroundColor: colors.accentGreen}]} />}
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
