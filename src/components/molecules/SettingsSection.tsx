import React from 'react';
import {StyleSheet, View} from 'react-native';
import PrimaryText from '../atoms/PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

/** A titled Settings card; draws the divider between its rows itself. */
export const SettingsSection: React.FC<SettingsSectionProps> = ({title, children}) => {
  const colors = useThemeColors();
  const rows = React.Children.toArray(children);
  return (
    <>
      <PrimaryText
        size={11}
        weight="semibold"
        color={colors.accentGreen}
        style={[gs.mt20, gs.mb6, styles.title]}
        accessibilityRole="header">
        {title}
      </PrimaryText>
      <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
        {rows.map((row, index) => (
          <React.Fragment key={React.isValidElement(row) && row.key !== null ? row.key : index}>
            {index > 0 ? <View style={[gs.mx16, styles.divider, {backgroundColor: colors.secondaryAccent}]} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  title: {letterSpacing: 0.8},
  divider: {height: 1},
});
