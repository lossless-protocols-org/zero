import React, {useState} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Icon from '../../components/atoms/Icons';
import PrimaryText from '../../components/atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {useMigrationFailed} from '../../hooks/useMigrationFailed';
import {gs, hitSlop} from '../../styles/globalStyles';

/** Shown while a data migration has given up; Retry runs them again. */
export const MigrationRetryCard: React.FC<{onRetry: () => Promise<boolean>}> = ({onRetry}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [migrationFailed, setMigrationFailed] = useState(useMigrationFailed());

  if (!migrationFailed) {
    return null;
  }

  const handleRetryPress = async () => {
    if (await onRetry()) {
      setMigrationFailed(false);
    }
  };

  return (
    <View
      style={[
        gs.rounded12,
        gs.px14,
        gs.py12,
        gs.mt20,
        gs.rowCenter,
        gs.gap10,
        styles.card,
        {backgroundColor: colors.containerColor, borderColor: colors.accentOrange},
      ]}>
      <Icon name="alert-triangle" size={18} color={colors.accentOrange} />
      <View style={gs.flex1}>
        <PrimaryText size={13} weight="semibold" color={colors.accentOrange}>
          {t('settings.dataWarningTitle')}
        </PrimaryText>
        <PrimaryText size={11} color={colors.secondaryText} style={gs.mt2}>
          {t('settings.dataWarningMessage')}
        </PrimaryText>
        <TouchableOpacity onPress={handleRetryPress} hitSlop={hitSlop} style={gs.mt6}>
          <PrimaryText size={12} weight="semibold" color={colors.accentGreen}>
            {t('settings.dataWarningRetry')}
          </PrimaryText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {borderWidth: 1},
});
