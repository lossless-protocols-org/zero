import {TouchableOpacity, View} from 'react-native';
import React, {memo} from 'react';
import {Icon} from '../atoms/Icons';
import {MeshAvatar} from '../atoms/MeshAvatar';
import {useThemeColors} from '../hooks/useThemeColors';
import {useRenameSheet, useUserName} from '../hooks/useUserName';
import {navigate} from '../../platform/navigationUtils';
import {PrimaryText} from '../atoms/PrimaryText';
import {gs, hitSlop} from '../globalStyles';
import {useTranslation} from 'react-i18next';

interface HeaderContainerProps {
  headerText: string;
}

const HeaderContainerComponent: React.FC<HeaderContainerProps> = ({headerText}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {userName} = useUserName();
  const openRename = useRenameSheet();

  return (
    <View style={[gs.rowCenter, gs.mt15, gs.justifyBetween]}>
      <View style={[gs.rowCenter, gs.flex1, gs.gap12]}>
        <TouchableOpacity
          onPress={openRename}
          hitSlop={hitSlop} // the avatar is drawn at 40
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

export const HeaderContainer = memo(HeaderContainerComponent);
