import {Text, TextStyle, StyleProp, Pressable, type TextProps} from 'react-native';
import React, {ReactNode, useMemo, memo} from 'react';
import useThemeColors from '../../hooks/useThemeColors';

type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';
type FontVariant = 'text' | 'number';

const FONTS: Record<FontWeight, string> = {
  regular: 'GoogleSansCode-Regular',
  medium: 'GoogleSansCode-Medium',
  semibold: 'GoogleSansCode-SemiBold',
  bold: 'GoogleSansCode-Bold',
};

// The number variant used to point at an identical second font map. It now
// means one thing: tabular (fixed-width) digits, so amounts in a column line up
// and a counting value does not jiggle as its digits change.
const NUMBER_FONT_VARIANT: TextStyle['fontVariant'] = ['tabular-nums'];

/** Passed straight to the Text: screen-reader roles and labels (M28/M29), and the
 * font-scale cap one-line amounts need so large text cannot truncate a number (M30). */
type PassThroughProps = Pick<
  TextProps,
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityLiveRegion'
  | 'accessible'
  | 'maxFontSizeMultiplier'
  | 'adjustsFontSizeToFit'
>;

interface PrimaryTextProps extends PassThroughProps {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  size?: number;
  weight?: FontWeight;
  variant?: FontVariant;
  color?: string;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  onPress?: () => void;
  selectable?: boolean;
  /** Leave undefined (RN default: true). Set false only for fixed-size chrome
   * whose box cannot grow with the OS font setting — e.g. avatar initials. */
  allowFontScaling?: boolean;
}

const PrimaryText: React.FC<PrimaryTextProps> = ({
  children,
  style,
  size = 14,
  weight = 'medium',
  variant = 'text',
  color,
  numberOfLines,
  ellipsizeMode,
  onPress,
  selectable = false,
  allowFontScaling,
  ...passThrough
}) => {
  const colors = useThemeColors();

  const resolvedEllipsizeMode = ellipsizeMode ?? (numberOfLines ? 'tail' : undefined);

  const textStyle = useMemo<TextStyle>(
    () => ({
      fontSize: size,
      fontFamily: FONTS[weight],
      fontVariant: variant === 'number' ? NUMBER_FONT_VARIANT : undefined,
      includeFontPadding: false,
      color: color ?? colors.primaryText,
      flexShrink: numberOfLines ? 1 : undefined,
    }),
    [size, weight, variant, color, colors.primaryText, numberOfLines],
  );

  const textElement = (
    <Text
      style={[textStyle, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={resolvedEllipsizeMode}
      selectable={selectable}
      allowFontScaling={allowFontScaling}
      {...passThrough}>
      {children}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {textElement}
      </Pressable>
    );
  }

  return textElement;
};

export default memo(PrimaryText);
