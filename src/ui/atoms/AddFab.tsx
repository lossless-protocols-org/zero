import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from './Icons';
import {FabCorner} from './FabCorner';
import type {ThemeColors} from '../hooks/useThemeColors';
import {gs, hitSlop} from '../globalStyles';

/**
 * What a screen's add button adds. Every add button is the same quiet tile
 * (the app's own raised-surface colour, no shadow: owner, 2.8); only the
 * icon carries meaning, in the colour the app already gives that thing:
 * green for money in (as on Received and "back"), blue for people and their
 * debts, the text colour for spending and categories. The glyph is always
 * the same plus (owner: the Debts button adds any debt, not just a person).
 */
type AddKind = 'expense' | 'income' | 'person' | 'debt' | 'category';

const inkOf = (kind: AddKind, colors: ThemeColors): string => {
  switch (kind) {
    case 'income':
      return colors.accentGreen;
    case 'person':
    case 'debt':
      return colors.accentBlue;
    case 'expense':
    case 'category':
      return colors.primaryText;
  }
};

interface AddFabProps {
  kind: AddKind;
  onPress: () => void;
  /** Spoken name: what it adds ("Add money in"). */
  label: string;
  colors: ThemeColors;
  hidden?: boolean;
  /** A screen without the tab bar: clear the home indicator itself. */
  aboveSafeArea?: boolean;
}

/** The floating add button of a screen (bottom end corner). */
export const AddFab: React.FC<AddFabProps> = ({kind, onPress, label, colors, hidden, aboveSafeArea}) => {
  const insets = useSafeAreaInsets();
  const ink = inkOf(kind, colors);
  const button = (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({pressed}) => [
        gs.center,
        styles.fab,
        {backgroundColor: colors.secondaryBackground, opacity: pressed ? 0.7 : 1},
      ]}>
      <Icon name="plus" size={26} color={ink} strokeWidth={2.25} />
    </Pressable>
  );
  return (
    <FabCorner hidden={hidden}>
      {aboveSafeArea ? <View style={{marginBottom: Math.max(insets.bottom - 10, 0) + 5}}>{button}</View> : button}
    </FabCorner>
  );
};

const styles = StyleSheet.create({
  fab: {width: 52, height: 52, borderRadius: 14},
});
