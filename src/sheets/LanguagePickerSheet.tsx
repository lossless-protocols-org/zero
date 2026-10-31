import {TouchableOpacity, View} from 'react-native';
import React, {useCallback, useState} from 'react';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import {useTranslation} from 'react-i18next';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryText from '../components/atoms/PrimaryText';
import PrimaryButton from '../components/atoms/PrimaryButton';
import {gs} from '../styles/globalStyles';

const LANGUAGES = [{code: 'en', label: 'English'}] as const;

const LanguagePickerSheet: React.FC<SheetProps<'language-picker-sheet'>> = React.memo(props => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const [selected, setSelected] = useState(props.payload?.currentLanguage ?? 'en');

  const handleConfirm = useCallback(() => {
    props.payload?.onSelect?.(selected);
    void SheetManager.hide(props.sheetId);
  }, [props, selected]);

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('settings.language'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            onPress={() => setSelected(lang.code)}
            activeOpacity={0.6}
            accessibilityRole="radio"
            accessibilityState={{checked: selected === lang.code}}>
            <View style={[gs.rowBetweenCenter, gs.py12]}>
              <PrimaryText size={15} weight={selected === lang.code ? 'semibold' : 'medium'}>
                {lang.label}
              </PrimaryText>
              <View
                style={[
                  gs.size20,
                  gs.rounded10,
                  gs.border2,
                  gs.center,
                  {borderColor: selected === lang.code ? colors.accentGreen : colors.secondaryText},
                ]}>
                {selected === lang.code && (
                  <View style={[gs.size10, gs.rounded5, {backgroundColor: colors.accentGreen}]} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <PrimaryText size={12} color={colors.secondaryText} style={[gs.mt10, gs.textCenter]}>
          {t('sheets.moreLanguages')}
        </PrimaryText>
        <View style={gs.mt10}>
          <PrimaryButton onPress={handleConfirm} colors={colors} buttonTitle={t('common.apply')} />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

export default LanguagePickerSheet;
