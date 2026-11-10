import React, {memo} from 'react';
import {I18nManager, View} from 'react-native';
import {ICON_REGISTRY, isValidIconName, type IconName} from './IconRegistry';
import {appendErrorLog} from '../../platform/errorLog';

interface IconStyle {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Exactly one of:
 * - `name`: an icon written in code. Typed, so a typo fails to compile
 *   instead of shipping as a blank square (audit 2026-11-08 §5).
 * - `dynamicName`: an icon name from data (a category's or debtor's, picked
 *   by the user, or from a backup). Checked at run time; an unknown one shows
 *   FALLBACK_ICON and is logged to Diagnostics once.
 */
type IconProps = IconStyle & ({name: IconName; dynamicName?: never} | {dynamicName: string; name?: never});

/** Shown for a data icon name the registry does not have (a backup from another build, say). */
const FALLBACK_ICON: IconName = 'circle-dot';
const reportedUnknown = new Set<string>();

const resolveIcon = (props: IconProps): IconName => {
  if (props.name !== undefined) {
    return props.name;
  }
  if (isValidIconName(props.dynamicName)) {
    return props.dynamicName;
  }
  // '' is "no icon chosen" (DEFAULTS.icon), not a broken name: fall back quietly.
  if (props.dynamicName !== '' && !reportedUnknown.has(props.dynamicName)) {
    reportedUnknown.add(props.dynamicName);
    appendErrorLog(new Error(`Icon "${props.dynamicName}" is not in the registry; showing ${FALLBACK_ICON}`), false);
  }
  return FALLBACK_ICON;
};

// Glyphs that point along the reading direction (back, previous, next, "go
// to"); a right-to-left layout mirrors them (M32, v2.7.1).
const DIRECTIONAL: ReadonlySet<string> = new Set<IconName>(['arrow-left', 'chevron-left', 'chevron-right']);
const MIRRORED = {transform: [{scaleX: -1}]};

const IconComponent: React.FC<IconProps> = props => {
  const {size = 24, color = '#000000', strokeWidth = 2} = props;
  const name = resolveIcon(props);
  const Glyph = ICON_REGISTRY[name];

  // Read per render, not at import: the layout direction is set before the first render.
  const mirrored = I18nManager.isRTL && DIRECTIONAL.has(name);

  const icon = <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
  // On a View, not the Svg: react-native-svg applies a style transform around
  // (0,0), which flipped the glyph out of its box and the back arrow vanished.
  return mirrored ? <View style={MIRRORED}>{icon}</View> : icon;
};

export const Icon = memo(IconComponent);
