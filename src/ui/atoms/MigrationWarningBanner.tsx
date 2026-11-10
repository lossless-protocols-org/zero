import React, {useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from './Icons';
import {PrimaryText} from './PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {useMigrationFailed} from '../hooks/useMigrationFailed';
import {gs, hitSlop} from '../globalStyles';

/**
 * Launch-time surface for a permanently failed data migration. Non-blocking:
 * the app stays usable, the banner points at Settings where the user can
 * retry (see SettingsScreen's data warning section).
 */
const MigrationWarningBannerComponent = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);

  const migrationFailed = useMigrationFailed();
  if (dismissed || !migrationFailed) {
    return null;
  }

  return (
    <View
      style={[
        gs.rowCenter,
        gs.gap10,
        gs.px14,
        gs.py10,
        gs.borderBottom1,
        {
          paddingTop: insets.top + 10,
          backgroundColor: colors.containerColor,
          borderBottomColor: colors.accentOrange,
        },
      ]}>
      <Icon name="alert-triangle" size={16} color={colors.accentOrange} />
      <View style={gs.flex1}>
        <PrimaryText size={12} weight="semibold" color={colors.accentOrange}>
          {t('settings.dataWarningTitle')}
        </PrimaryText>
        <PrimaryText size={10} color={colors.secondaryText}>
          {t('settings.dataWarningBannerHint')}
        </PrimaryText>
      </View>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={t('common.done')}>
        <Icon name="x" size={16} color={colors.secondaryText} />
      </TouchableOpacity>
    </View>
  );
};

export const MigrationWarningBanner = React.memo(MigrationWarningBannerComponent);
