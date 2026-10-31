import {TouchableOpacity, View} from 'react-native';
import React, {memo, useCallback} from 'react';
import Icon from '../atoms/Icons';
import MeshAvatar from '../atoms/MeshAvatar';
import useThemeColors from '../../hooks/useThemeColors';
import {useUserName} from '../../hooks/useUserName';
import {navigate} from '../../utils/navigationUtils';
import PrimaryText from '../atoms/PrimaryText';
import {SheetManager} from 'react-native-actions-sheet';
import {gs, hitSlop} from '../../styles/globalStyles';
import {useTranslation} from 'react-i18next';
import {useDialog} from '../../context/DialogContext';
import {appendErrorLog, logRejection} from '../../utils/errorLog';

interface HeaderContainerProps {
  headerText: string;
}

const HeaderContainer: React.FC<HeaderContainerProps> = ({headerText}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {showAlert} = useDialog();
  const {userName, rename} = useUserName();

  const handleProfileClick = useCallback(() => {
    void SheetManager.show('change-name-sheet', {
      payload: {
        currentName: userName,
        onUpdate: (newName: string) => {
          rename(newName).catch((error: unknown) => {
            appendErrorLog(error, false);
            logRejection(showAlert({type: 'error', message: t('settings.saveFailed')}));
          });
        },
      },
    });
  }, [userName, rename, showAlert, t]);

  return (
    <View style={[gs.rowCenter, gs.mt15, gs.justifyBetween]}>
      <View style={[gs.rowCenter, gs.flex1, gs.gap12]}>
        <TouchableOpacity
          onPress={handleProfileClick}
          accessibilityRole="button"
          accessibilityLabel={t('sheets.changeName')}>
          <MeshAvatar
            name={userName ?? ''}
            size={40}
            bgColor={colors.accentGreen}
            textColor={colors.buttonText}
            meshColor={colors.buttonText}
          />
        </TouchableOpacity>
        <PrimaryText size={16} weight="semibold" accessibilityRole="header">
          {headerText}
        </PrimaryText>
      </View>
      <TouchableOpacity
        onPress={() => navigate('SettingsScreen')}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}>
        <Icon name="settings" size={22} color={colors.secondaryText} />
      </TouchableOpacity>
    </View>
  );
};

export default memo(HeaderContainer);
