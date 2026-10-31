import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import Icon from './Icons';
import PrimaryText from './PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';

interface SettingsRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  value?: string;
  valueNode?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** For rows whose valueNode is the control (a Switch): no trailing chevron. */
  hideChevron?: boolean;
  accessibilityRole?: 'button' | 'switch';
  accessibilityState?: {checked?: boolean};
}

const SettingsRowView: React.FC<SettingsRowProps> = ({
  icon,
  label,
  subtitle,
  value,
  valueNode,
  onPress,
  destructive,
  hideChevron = false,
  accessibilityRole,
  accessibilityState,
}) => {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={accessibilityRole ?? (onPress ? 'button' : undefined)}
      accessibilityState={accessibilityState}
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}>
      <View style={[gs.rowCenter, gs.px14, gs.py12, gs.gap10]}>
        <View style={[gs.size32, gs.rounded8, gs.center, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name={icon} size={16} color={destructive ? colors.accentOrange : colors.secondaryText} />
        </View>
        <View style={[gs.flex1, gs.gap2]}>
          <PrimaryText size={14} weight="medium" color={destructive ? colors.accentOrange : colors.primaryText}>
            {label}
          </PrimaryText>
          {subtitle ? (
            <PrimaryText size={11} color={colors.secondaryText}>
              {subtitle}
            </PrimaryText>
          ) : null}
        </View>
        {value ? (
          <PrimaryText size={13} color={colors.secondaryText}>
            {value}
          </PrimaryText>
        ) : null}
        {valueNode ?? null}
        {onPress && !hideChevron ? <Icon name="chevron-right" size={14} color={colors.secondaryText} /> : null}
      </View>
    </TouchableOpacity>
  );
};

/** One row of a Settings section: icon, label, optional subtitle and value, chevron when tappable. */
export const SettingsRow = React.memo(SettingsRowView);
