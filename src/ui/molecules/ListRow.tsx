import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon} from '../atoms/Icons';
import {PrimaryText} from '../atoms/PrimaryText';
import {Amount} from '../atoms/Amount';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';
import type {IconName} from '../atoms/IconRegistry';

interface ListRowProps {
  /** An icon written in code. */
  icon?: IconName;
  /** An icon name from data (a category's, an account's). */
  dynamicIcon?: string;
  iconColor?: string;
  /** Something else in the tile's place (a date tile). Wins over the icons. */
  tile?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** A money figure at the end, in the app's amount style. */
  amount?: string;
  amountColor?: string;
  /** A quiet value at the end ("14 days"). */
  value?: string;
  /** A control at the end (a button, a switch, a chip). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Shown by default on a tappable row with no control of its own. */
  chevron?: boolean;
  /** A row that is there but not live (a paused rule). */
  dimmed?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const RowIcon: React.FC<Pick<ListRowProps, 'icon' | 'dynamicIcon' | 'iconColor' | 'tile'>> = ({
  icon,
  dynamicIcon,
  iconColor,
  tile,
}) => {
  const colors = useThemeColors();
  if (tile) {
    return <>{tile}</>;
  }
  if (!icon && dynamicIcon === undefined) {
    return null;
  }
  const color = iconColor || colors.secondaryText;
  return (
    <View style={[gs.size36, gs.center, gs.rounded10, {backgroundColor: colors.iconContainer}]}>
      {icon ? (
        <Icon name={icon} size={18} color={color} />
      ) : (
        <Icon dynamicName={dynamicIcon ?? ''} size={18} color={color} />
      )}
    </View>
  );
};

/**
 * One row of a ListSection: an icon tile, a title with an optional second
 * line, and at the end an amount, a value or a control. The row Home and
 * Settings each drew for themselves, shared (UX revamp v2).
 */
const ListRowView: React.FC<ListRowProps> = ({
  icon,
  dynamicIcon,
  iconColor,
  tile,
  title,
  subtitle,
  amount,
  amountColor,
  value,
  trailing,
  onPress,
  chevron,
  dimmed = false,
  accessibilityLabel,
  testID,
}) => {
  const colors = useThemeColors();
  const showChevron = chevron ?? (Boolean(onPress) && !trailing);
  const label = accessibilityLabel ?? [title, subtitle, amount ?? value].filter(Boolean).join(', ');
  const content = (
    <View style={[gs.rowCenter, gs.px14, gs.py10, gs.gap10, gs.minH48, dimmed && gs.dimmed]}>
      <RowIcon icon={icon} dynamicIcon={dynamicIcon} iconColor={iconColor} tile={tile} />
      <View style={[gs.flex1, gs.gap2]}>
        <PrimaryText size={14} weight="medium" numberOfLines={1}>
          {title}
        </PrimaryText>
        {subtitle ? (
          <PrimaryText size={11} color={colors.secondaryText} numberOfLines={2}>
            {subtitle}
          </PrimaryText>
        ) : null}
      </View>
      {amount ? <Amount color={amountColor}>{amount}</Amount> : null}
      {value ? (
        <PrimaryText size={13} color={colors.secondaryText} numberOfLines={1}>
          {value}
        </PrimaryText>
      ) : null}
      {trailing ?? null}
      {showChevron ? <Icon name="chevron-right" size={14} color={colors.secondaryText} /> : null}
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}>
      {content}
    </TouchableOpacity>
  );
};

export const ListRow = React.memo(ListRowView);
