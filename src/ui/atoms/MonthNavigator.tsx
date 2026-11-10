import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Icon} from './Icons';
import {PrimaryText} from './PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs, hitSlop} from '../globalStyles';

interface MonthNavigatorProps {
  /** "October 2026"; always the accessible name. */
  label: string;
  /** "Oct 2026": what the compact pill shows, so it leaves room beside it. */
  shortLabel?: string;
  canGoForward: boolean;
  onShift: (delta: -1 | 1) => void;
  /** Makes the label open the month picker. Home leaves it out: its whole card does that. */
  onOpenPicker?: () => void;
  /** The smaller pill Reports uses. */
  compact?: boolean;
  /** Text and icon colour: white on the green cards (default), the text colour on a plain surface. */
  color?: string;
}

/**
 * ‹ Month Year ▾ › — the chevrons step one month; the picker handles long
 * jumps. One review: "I have to click many times just to get to another month."
 */
const MonthNavigatorView: React.FC<MonthNavigatorProps> = ({
  label,
  shortLabel,
  canGoForward,
  onShift,
  onOpenPicker,
  compact = false,
  color,
}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const tint = color ?? colors.buttonText;
  const iconSize = compact ? 16 : 18;

  const title = (
    <>
      <PrimaryText size={compact ? 13 : 14} weight="semibold" color={tint} numberOfLines={1}>
        {compact && shortLabel ? shortLabel : label}
      </PrimaryText>
      <Icon name="chevron-down" size={compact ? 12 : 14} color={tint} />
    </>
  );

  return (
    <View style={compact ? gs.rowCenter : [gs.rowCenter, gs.gap6]}>
      <TouchableOpacity
        onPress={() => onShift(-1)}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={t('home.previousMonth')}
        style={compact ? styles.compactChevron : undefined}>
        <Icon name="chevron-left" size={iconSize} color={tint} />
      </TouchableOpacity>
      {onOpenPicker ? (
        <TouchableOpacity
          onPress={onOpenPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('sheets.selectMonthYear')}
          style={compact ? [gs.rowCenter, styles.compactTitle] : [gs.rowCenter, gs.gap6]}>
          {title}
        </TouchableOpacity>
      ) : (
        <View style={[gs.rowCenter, gs.gap6]}>{title}</View>
      )}
      <TouchableOpacity
        // Not `disabled`: a disabled touchable lets the tap fall through to
        // the pill and open the picker. A no-op press swallows it.
        onPress={canGoForward ? () => onShift(1) : () => undefined}
        hitSlop={hitSlop}
        accessibilityRole="button"
        // Not accessibilityState.disabled either: on Android that sets the
        // native view non-clickable, which is the fall-through again.
        accessibilityLabel={canGoForward ? t('home.nextMonth') : t('home.nextMonthUnavailable')}
        style={[compact ? styles.compactChevron : undefined, canGoForward ? undefined : gs.dimmed]}>
        <Icon name="chevron-right" size={iconSize} color={tint} />
      </TouchableOpacity>
    </View>
  );
};

export const MonthNavigator = React.memo(MonthNavigatorView);

// Compact (Reports): tight padding so the pill is only as wide as its text;
// the shared hitSlop keeps each target past 44 pt.
const styles = StyleSheet.create({
  compactChevron: {paddingHorizontal: 8, paddingVertical: 10},
  compactTitle: {gap: 3, paddingVertical: 10},
});
