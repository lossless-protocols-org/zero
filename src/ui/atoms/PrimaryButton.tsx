import {TouchableOpacity, View, ActivityIndicator} from 'react-native';
import React, {useMemo} from 'react';
import {PrimaryText} from './PrimaryText';
import {Icon} from './Icons';
import type {ThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';
import type {IconName} from './IconRegistry';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_HEIGHTS: Record<ButtonSize, number> = {
  sm: 36,
  md: 48,
  lg: 56,
};

const FONT_SIZES: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

const ICON_SIZES: Record<ButtonSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

interface PrimaryButtonProps {
  onPress: () => void;
  colors: ThemeColors;
  buttonTitle: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = React.memo(
  ({
    onPress,
    colors,
    buttonTitle,
    disabled = false,
    loading = false,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    fullWidth = true,
  }) => {
    const isDisabled = disabled || loading;

    const buttonStyles = useMemo(() => {
      const height = BUTTON_HEIGHTS[size];

      let backgroundColor: string;
      let borderColor: string | undefined;
      let borderWidth = 0;

      switch (variant) {
        case 'secondary':
          backgroundColor = colors.secondaryAccent;
          break;
        case 'outline':
          backgroundColor = 'transparent';
          borderColor = colors.primaryText;
          borderWidth = 2;
          break;
        case 'ghost':
          backgroundColor = 'transparent';
          break;
        case 'primary':
        default:
          backgroundColor = isDisabled ? colors.secondaryText : colors.primaryText;
          break;
      }

      return {
        // A minimum, not a fixed height: large OS text must not clip the label (M30).
        minHeight: height,
        backgroundColor,
        borderColor,
        borderWidth,
        width: fullWidth ? ('100%' as const) : undefined,
      };
    }, [variant, size, colors, isDisabled, fullWidth]);

    const textColor = useMemo(() => {
      switch (variant) {
        case 'secondary':
          return colors.primaryText;
        case 'outline':
        case 'ghost':
          return colors.primaryText;
        case 'primary':
        default:
          return colors.buttonText;
      }
    }, [variant, colors]);

    const fontSize = FONT_SIZES[size];
    const iconSize = ICON_SIZES[size];

    const renderContent = () => {
      if (loading) {
        return <ActivityIndicator size="small" color={textColor} />;
      }

      const iconElement = icon ? <Icon name={icon} size={iconSize} color={textColor} /> : null;

      return (
        <View style={gs.rowCenter}>
          {icon && iconPosition === 'left' && <View style={gs.mr8}>{iconElement}</View>}
          <PrimaryText size={fontSize} weight="medium" color={textColor}>
            {buttonTitle}
          </PrimaryText>
          {icon && iconPosition === 'right' && <View style={gs.ml8}>{iconElement}</View>}
        </View>
      );
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
        accessibilityLabel={buttonTitle}
        accessibilityRole="button"
        accessibilityState={{disabled: isDisabled}}>
        <View style={[gs.rounded10, gs.center, buttonStyles]}>{renderContent()}</View>
      </TouchableOpacity>
    );
  },
);
