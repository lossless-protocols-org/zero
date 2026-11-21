/**
 * CustomBottomSheet for suites about what a sheet says and does: its title
 * and its children, drawn in place, with its close button. The real one is a
 * native sheet that jest cannot open.
 *
 *   jest.mock('<…>/src/ui/atoms/CustomBottomSheet', () => require('<…>/harness/mocks/bottomSheet'));
 */
import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

interface Props {
  children: React.ReactNode;
  header?: {title?: string; onClosePress?: () => void} | null;
}

export const CustomBottomSheet = ({children, header}: Props) => (
  <View>
    {header?.title ? <Text accessibilityRole="header">{header.title}</Text> : null}
    {header?.onClosePress ? (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="close-sheet" onPress={header.onClosePress} />
    ) : null}
    {children}
  </View>
);
