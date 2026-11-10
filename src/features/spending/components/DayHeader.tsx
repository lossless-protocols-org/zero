import {View} from 'react-native';
import React, {memo} from 'react';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Amount} from '../../../ui/atoms/Amount';
import {gs} from '../../../ui/globalStyles';

/**
 * A day's header in a spending list: its label and the day's net spending,
 * formatted by the list (useFormatSpend), so a header subscribes to nothing.
 */
export const DayHeader: React.FC<{
  label: string;
  /** The day's net spending, formatted ("₹420", or "₹62 back"). */
  spend: string;
  /** Refunds outweighed the day's spending: coloured as money back. */
  isBack: boolean;
  colors: ThemeColors;
  edgeToEdge: boolean;
}> = memo(({label, spend, isBack, colors, edgeToEdge}) => (
  <View style={[gs.rowBetweenCenter, gs.mb8, gs.mt15, edgeToEdge && gs.px16]}>
    <PrimaryText size={12} weight="semibold" color={colors.secondaryText}>
      {label}
    </PrimaryText>
    {/* A day whose refunds outweigh its spending reads as money back, not a minus sign. */}
    <Amount size={12} color={isBack ? colors.accentGreen : colors.secondaryText}>
      {spend}
    </Amount>
  </View>
));
