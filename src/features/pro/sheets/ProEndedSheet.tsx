import React, {useCallback} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {logRejection} from '../../../platform/errorLog';
import {CustomBottomSheet} from '../../../ui/atoms/CustomBottomSheet';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {gs} from '../../../ui/globalStyles';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {usePreference} from '../../../ui/hooks/usePreference';
import {autoBackupLastAtPreference, autoBackupOnPreference} from '../../../platform/backupPreferences';
import {formatDisplayDate} from '../../../platform/dateFormat';
import {DEFAULT_MONTH_START_DAY} from '../../../domain/period';
import {getStoredMonthStartDay} from '../../../pro/monthStart';

/**
 * Said once when Pro ends (3.0, entitlement design §6): what stopped, and
 * that nothing was lost. No countdown and no second prompt; Resume opens the
 * upgrade sheet, OK closes this for good for this ending.
 */
export const ProEndedSheet: React.FC<SheetProps<'pro-ended-sheet'>> = ({sheetId}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  // P10: someone who relied on automatic backup must hear that it stopped too.
  const autoBackupWasOn = usePreference(autoBackupOnPreference);
  const lastBackupAt = usePreference(autoBackupLastAtPreference);
  // P11: someone whose month ran payday to payday must hear that it is the calendar month again.
  const monthStartDay = getStoredMonthStartDay();
  const close = useCallback(() => SheetManager.hide(sheetId), [sheetId]);
  const resume = useCallback(async () => {
    await close();
    void SheetManager.show('upgrade-sheet');
  }, [close]);

  return (
    <CustomBottomSheet
      sheetId={sheetId}
      header={{title: t('pro.endedTitle'), showCloseButton: true, onClosePress: () => logRejection(close())}}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5, gs.gap12]}>
        <PrimaryText size={14}>{t('pro.endedBody')}</PrimaryText>
        {monthStartDay !== DEFAULT_MONTH_START_DAY ? (
          <PrimaryText size={14}>{t('pro.endedMonthStart', {day: monthStartDay})}</PrimaryText>
        ) : null}
        {autoBackupWasOn ? (
          <PrimaryText size={14}>
            {lastBackupAt > 0
              ? t('pro.endedAutoBackupLast', {when: formatDisplayDate(lastBackupAt, 'dateTime')})
              : t('pro.endedAutoBackup')}
          </PrimaryText>
        ) : null}
        <PrimaryButton onPress={() => logRejection(resume())} colors={colors} buttonTitle={t('pro.resume')} />
        <PrimaryButton
          onPress={() => logRejection(close())}
          colors={colors}
          buttonTitle={t('common.ok')}
          variant="ghost"
        />
      </View>
    </CustomBottomSheet>
  );
};
