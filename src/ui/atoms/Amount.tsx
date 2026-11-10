import React, {memo} from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {PrimaryText} from './PrimaryText';

/**
 * How far an amount grows with the OS text size. Past it, one-line amounts
 * pushed rows apart or truncated, and a truncated amount reads as a different
 * number ("₹53…" on the Moto at 2.0×, M30). 1.6× keeps the largest
 * accessibility sizes well above the default while the figure stays whole.
 */
export const AMOUNT_FONT_CAP = 1.6;

interface AmountProps {
  /** The formatted figure ("₹1,240.50"), or a short sentence around one ("₹40 back"). */
  children: string;
  size?: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
  style?: StyleProp<TextStyle>;
  /** What a screen reader says, when the figure alone is not enough. */
  accessibilityLabel?: string;
}

/**
 * Every money figure on screen (audit 2026-11-08 §9). One line, tabular
 * digits, growing with the OS text size up to AMOUNT_FONT_CAP and then
 * shrinking to fit its box rather than ending in "…". Amounts used to set
 * these one by one, and the largest (Home's month, Money's balance) set none.
 */
export const Amount = memo(
  ({children, size = 14, weight = 'semibold', color, style, accessibilityLabel}: AmountProps) => (
    <PrimaryText
      size={size}
      weight={weight}
      color={color}
      style={style}
      variant="number"
      numberOfLines={1}
      adjustsFontSizeToFit
      maxFontSizeMultiplier={AMOUNT_FONT_CAP}
      accessibilityLabel={accessibilityLabel}>
      {children}
    </PrimaryText>
  ),
);
