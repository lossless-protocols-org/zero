import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {PrimaryText} from '../atoms/PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';

interface ChoiceChipsProps<K> {
  choices: ReadonlyArray<{key: K; label: string}>;
  value: K;
  onChange: (key: K) => void;
}

/** One choice of a few, as chips in a row (a radio group to screen readers). */
export const ChoiceChips = <K extends string | number | null>({choices, value, onChange}: ChoiceChipsProps<K>) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.row, gs.wrap, gs.gap8, gs.mb15]} accessibilityRole="radiogroup">
      {choices.map(choice => {
        const selected = choice.key === value;
        return (
          <TouchableOpacity
            key={String(choice.key)}
            onPress={() => onChange(choice.key)}
            accessibilityRole="radio"
            accessibilityState={{checked: selected}}
            style={[
              gs.py8,
              gs.px14,
              gs.rounded12,
              gs.minTouch,
              {backgroundColor: selected ? colors.primaryText : colors.secondaryAccent},
            ]}>
            <PrimaryText size={13} weight="semibold" color={selected ? colors.buttonText : colors.secondaryText}>
              {choice.label}
            </PrimaryText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
