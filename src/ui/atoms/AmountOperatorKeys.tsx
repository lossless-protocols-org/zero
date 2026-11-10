import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {PrimaryText} from './PrimaryText';
import type {ThemeColors} from '../hooks/useThemeColors';
import {AMOUNT_OPERATORS, type AmountOperator} from '../../domain/amountExpression';
import {gs} from '../globalStyles';

/** + − × ÷ = as one row of equal keys, 44 dp tall to touch, then Done where the keyboard has none (iOS). */
export const AmountOperatorKeys: React.FC<{
  colors: ThemeColors;
  onPress: (key: AmountOperator | '=') => void;
  label: (key: AmountOperator | '=') => string;
  /** The calculator's keys; without them only Done shows. */
  operators: boolean;
  onDone?: () => void;
  doneLabel: string;
}> = ({colors, onPress, label, operators, onDone, doneLabel}) => (
  <View style={[gs.row, styles.keys, {backgroundColor: colors.primaryBackground}]}>
    {operators
      ? [...AMOUNT_OPERATORS, '=' as const].map(key => (
          <Pressable
            key={key}
            onPress={() => onPress(key)}
            accessibilityRole="button"
            accessibilityLabel={label(key)}
            style={({pressed}) => [
              gs.flex1,
              gs.center,
              gs.rounded10,
              styles.key,
              {backgroundColor: key === '=' ? colors.primaryText : colors.secondaryAccent, opacity: pressed ? 0.6 : 1},
            ]}>
            <PrimaryText size={20} weight="medium" color={key === '=' ? colors.buttonText : colors.primaryText}>
              {key}
            </PrimaryText>
          </Pressable>
        ))
      : null}
    {onDone ? (
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={doneLabel}
        style={({pressed}) => [
          operators ? undefined : styles.end,
          gs.center,
          styles.done,
          {opacity: pressed ? 0.6 : 1},
        ]}>
        <PrimaryText size={15} weight="semibold">
          {doneLabel}
        </PrimaryText>
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  keys: {gap: 8, paddingVertical: 6, paddingHorizontal: 8},
  key: {minHeight: 44},
  done: {minHeight: 44, paddingHorizontal: 10},
  end: {marginLeft: 'auto'},
});
