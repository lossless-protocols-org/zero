import React, {useCallback} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {goBack} from '../../../../platform/navigationUtils';
import {Icon} from '../../../../ui/atoms/Icons';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {gs} from '../../../../ui/globalStyles';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';

/**
 * "What's new in 3.0" (owner decision 14): one screen, shown once to an
 * install that updated from before 3.0, and never to a new one. It says what
 * stays free first. After it, the only way to zero Pro is the Settings row.
 */
export const WhatsNewScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const done = useCallback(() => goBack(), []);
  const seePro = useCallback(() => {
    goBack();
    void SheetManager.show('upgrade-sheet');
  }, []);

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.flex1, gs.justifyCenter, gs.gap12]}>
        <Icon name="sparkles" size={32} color={colors.accentGreen} />
        <PrimaryText size={24} weight="semibold" accessibilityRole="header">
          {t('pro.whatsNewTitle')}
        </PrimaryText>
        <PrimaryText size={15}>{t('pro.whatsNewFree')}</PrimaryText>
        <PrimaryText size={15}>{t('pro.whatsNewPro')}</PrimaryText>
        <PrimaryText size={13} color={colors.secondaryText}>
          {t('pro.whatsNewWhere')}
        </PrimaryText>
      </View>
      <View style={[gs.gap8, gs.mb20]}>
        <PrimaryButton onPress={seePro} colors={colors} buttonTitle={t('pro.whatsNewSee')} />
        <PrimaryButton onPress={done} colors={colors} buttonTitle={t('pro.whatsNewDone')} variant="ghost" />
      </View>
    </PrimaryView>
  );
};
