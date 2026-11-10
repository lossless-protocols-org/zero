import React from 'react';
import {I18nManager, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

/**
 * The bottom-end corner a screen's floating button sits in, 15 dp in from
 * the safe area (2.8): in landscape the navigation bar is on a side, and the
 * button used to sit under it with Back drawn over it (Moto g84).
 */
export const FabCorner: React.FC<{children: React.ReactNode; hidden?: boolean}> = ({children, hidden = false}) => {
  const insets = useSafeAreaInsets();
  const edge = 15 + (I18nManager.isRTL ? insets.left : insets.right);
  return <View style={[styles.corner, {end: edge}, hidden && styles.hidden]}>{children}</View>;
};

const styles = StyleSheet.create({
  corner: {position: 'absolute', bottom: 15, zIndex: 1},
  hidden: {display: 'none'},
});
