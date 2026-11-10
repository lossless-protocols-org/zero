import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from './PrimaryText';
import type {ThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';

interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  /** Shown small after the label ("Expense 16"). */
  count?: number;
}

interface SegmentedTabsProps<K extends string> {
  tabs: readonly SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  colors: ThemeColors;
}

/**
 * Two or three equal tabs at the top of a screen (2.8): one part of the screen
 * at a time instead of one long scroll (Categories: Expense / Income; Money:
 * Received / Debts). A tablist to screen readers, each tab 44 dp tall.
 */
export const SegmentedTabs = <K extends string>({tabs, value, onChange, colors}: SegmentedTabsProps<K>) => {
  const {t} = useTranslation();
  return (
    <View
      accessibilityRole="tablist"
      style={[gs.row, gs.rounded12, styles.track, {backgroundColor: colors.secondaryAccent}]}>
      {tabs.map(tab => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            accessibilityLabel={
              tab.count === undefined ? tab.label : t('common.fieldValue', {field: tab.label, value: tab.count})
            }
            style={[
              gs.flex1,
              gs.rowCenter,
              gs.justifyCenter,
              gs.rounded10,
              gs.gap6,
              styles.tab,
              selected && {backgroundColor: colors.primaryText},
            ]}>
            <PrimaryText size={13} weight="semibold" color={selected ? colors.buttonText : colors.secondaryText}>
              {tab.label}
            </PrimaryText>
            {tab.count === undefined ? null : (
              <PrimaryText size={11} variant="number" color={selected ? colors.buttonText : colors.secondaryText}>
                {tab.count}
              </PrimaryText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {padding: 3},
  // 44: the documented minimum (audit 2026-11-08 §9: it was 40, under its own comment).
  tab: {minHeight: 44},
});
