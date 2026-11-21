import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {PrimaryText} from '../atoms/PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';

interface ListSectionProps {
  /** The small heading over the card. Left out: a card with no heading. */
  title?: string;
  /** A figure beside the heading: the group's subtotal. */
  trailing?: string;
  /** The trailing figure's own colour (red for what is owed, green for what is yours); the heading's when left out. */
  trailingColor?: string;
  /** 'attention': the heading is amber, for a group the user has to act on. */
  tone?: 'default' | 'attention';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A group of rows in one card, with dividers between them and a small
 * heading over it: the list shape Settings always had, shared so every
 * screen's lists read the same (UX revamp v2, rule "lists are grouped cards").
 * Falsy children are skipped, so `{cond ? <ListRow/> : null}` leaves no divider.
 */
export const ListSection: React.FC<ListSectionProps> = ({
  title,
  trailing,
  trailingColor,
  tone = 'default',
  children,
  style,
}) => {
  const colors = useThemeColors();
  const rows = React.Children.toArray(children);
  if (rows.length === 0) {
    return null;
  }
  const headingColor = tone === 'attention' ? colors.accentOrange : colors.accentGreen;
  return (
    <View style={style}>
      {title ? (
        <View style={[gs.rowBetweenCenter, gs.mb6, gs.gap8]}>
          <PrimaryText
            size={11}
            weight="semibold"
            color={headingColor}
            style={[styles.title, gs.flexShrink]}
            accessibilityRole="header">
            {title}
          </PrimaryText>
          {trailing ? (
            <PrimaryText size={11} weight="semibold" variant="number" color={trailingColor ?? headingColor}>
              {trailing}
            </PrimaryText>
          ) : null}
        </View>
      ) : null}
      <View style={[gs.rounded12, gs.overflowHidden, {backgroundColor: colors.containerColor}]}>
        {rows.map((row, index) => (
          <React.Fragment key={React.isValidElement(row) && row.key !== null ? row.key : index}>
            {index > 0 ? <View style={[gs.mx16, styles.divider, {backgroundColor: colors.secondaryAccent}]} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {letterSpacing: 0.8, textTransform: 'uppercase'},
  divider: {height: 1},
});
