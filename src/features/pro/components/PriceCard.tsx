import React from 'react';
import {View} from 'react-native';
import {PrimaryButton} from '../../../ui/atoms/PrimaryButton';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {gs} from '../../../ui/globalStyles';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';

interface PriceCardProps {
  title: string;
  /** The store's own price text inside its sentence ("₹99.00 a month"). */
  price: string;
  /** What is charged, when, and how it ends: shown before the button, never behind a tap. */
  terms: string;
  note?: string | null;
  action: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}

/** One way to buy zero Pro: its price, its terms in full, and the button. */
export const PriceCard: React.FC<PriceCardProps> = ({title, price, terms, note, action, onPress, busy, disabled}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.rounded12, gs.p14, gs.gap8, {backgroundColor: colors.containerColor}]}>
      <View style={gs.rowBetweenCenter}>
        <PrimaryText size={15} weight="semibold" accessibilityRole="header">
          {title}
        </PrimaryText>
        <PrimaryText size={15} weight="semibold" variant="number">
          {price}
        </PrimaryText>
      </View>
      <PrimaryText size={12} color={colors.secondaryText}>
        {terms}
      </PrimaryText>
      {note ? (
        <PrimaryText size={12} color={colors.accentGreen}>
          {note}
        </PrimaryText>
      ) : null}
      <PrimaryButton onPress={onPress} colors={colors} buttonTitle={action} loading={busy} disabled={disabled} />
    </View>
  );
};
