import React, {memo} from 'react';
import {I18nManager, View} from 'react-native';
import {ICON_REGISTRY, isValidIconName, type IconName} from './IconRegistry';

interface IconProps {
  /**
   * `IconName` gives autocomplete and typo-checking for names written in
   * code, while the `string` arm keeps accepting icon names loaded from the
   * database (users pick those at runtime, so they cannot be a literal type).
   * Unknown names are caught by isValidIconName below.
   */
  name: IconName | (string & {});
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Glyphs that point along the reading direction (back, previous, next, "go
// to"); a right-to-left layout mirrors them (M32, v2.7.1).
const DIRECTIONAL: ReadonlySet<string> = new Set<IconName>(['arrow-left', 'chevron-left', 'chevron-right']);
const MIRRORED = {transform: [{scaleX: -1}]};

const Icon: React.FC<IconProps> = ({name, size = 24, color = '#000000', strokeWidth = 2}) => {
  if (!isValidIconName(name)) {
    if (__DEV__) {
      console.warn(`Icon "${name}" not found in registry`);
    }
    return null;
  }

  const IconComponent = ICON_REGISTRY[name];

  // Read per render, not at import: the layout direction is set before the first render.
  const mirrored = I18nManager.isRTL && DIRECTIONAL.has(name);

  const icon = <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
  // On a View, not the Svg: react-native-svg applies a style transform around
  // (0,0), which flipped the glyph out of its box and the back arrow vanished.
  return mirrored ? <View style={MIRRORED}>{icon}</View> : icon;
};

export default memo(Icon);
export {type IconName} from './IconRegistry';
