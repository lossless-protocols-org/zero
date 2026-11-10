import React from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Icon} from './Icons';
import {PrimaryText} from './PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {useDataError} from '../hooks/useDataError';
import {gs} from '../globalStyles';

interface DataErrorBannerProps {
  /** Thunk domains this screen loads from: 'expense', 'budget', 'debt', … */
  domains: readonly string[];
}

/**
 * Shown where a screen's data would be when the last load of that data
 * failed (M1, v2.7.1). Replaces the "nothing here yet" empty state, which
 * read as "your entries are gone". The message itself stays in Diagnostics.
 */
const DataErrorBannerView: React.FC<DataErrorBannerProps> = ({domains}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const error = useDataError(domains);
  if (!error) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      style={[
        gs.rowCenter,
        gs.gap10,
        gs.px14,
        gs.py10,
        gs.mt10,
        gs.rounded12,
        gs.border1,
        {backgroundColor: colors.containerColor, borderColor: colors.accentOrange},
      ]}>
      <Icon name="alert-triangle" size={16} color={colors.accentOrange} />
      <View style={gs.flex1}>
        <PrimaryText size={12} weight="semibold" color={colors.accentOrange}>
          {t('dataError.banner')}
        </PrimaryText>
        <PrimaryText size={10} color={colors.secondaryText}>
          {t('dataError.hint')}
        </PrimaryText>
      </View>
    </View>
  );
};

/** Placed by each screen; it carries no side margin of its own. */
export const DataErrorBanner = React.memo(DataErrorBannerView);
