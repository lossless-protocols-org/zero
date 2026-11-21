import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs} from '../../../ui/globalStyles';

interface TrendRangeSwitchProps<K> {
  /** `label` is the short form drawn ("6M"); `spoken` is what it stands for ("6 months"). */
  choices: ReadonlyArray<{key: K; label: string; spoken: string}>;
  value: K;
  onChange: (key: K) => void;
}

/** Small to look at, 44 dp tall to touch. */
const HIT_SLOP = {top: 9, bottom: 9};

/** How many months the chart shows: one choice of a few, small enough to sit in the chart card's first row. */
export const TrendRangeSwitch = <K extends string | number>({choices, value, onChange}: TrendRangeSwitchProps<K>) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.row, gs.gap4]} accessibilityRole="radiogroup">
      {choices.map(choice => {
        const selected = choice.key === value;
        return (
          <TouchableOpacity
            key={String(choice.key)}
            onPress={() => onChange(choice.key)}
            hitSlop={HIT_SLOP}
            accessibilityRole="radio"
            accessibilityLabel={choice.spoken}
            accessibilityState={{checked: selected}}
            style={[
              gs.rounded8,
              gs.center,
              styles.choice,
              {backgroundColor: selected ? colors.primaryText : colors.secondaryAccent},
            ]}>
            <PrimaryText size={11} weight="semibold" color={selected ? colors.buttonText : colors.secondaryText}>
              {choice.label}
            </PrimaryText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  choice: {minWidth: 36, minHeight: 26, paddingHorizontal: 8, paddingVertical: 4},
});
