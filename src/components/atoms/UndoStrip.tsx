import React, {memo, useEffect} from 'react';
import {AccessibilityInfo, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryText from './PrimaryText';
import type {ThemeColors} from '../../hooks/useThemeColors';
import {gs} from '../../styles/globalStyles';

interface UndoStripProps {
  id: string;
  colors: ThemeColors;
  onUndo: (id: string) => void;
  edgeToEdge: boolean;
  /**
   * The deleted row's measured card height: the strip takes its place exactly,
   * so the list does not jump (it was 68 pt against a 56 pt row).
   */
  rowHeight?: number;
}

/** "Transaction deleted · Undo", shown where a row was for the undo window. */
export const UndoStrip: React.FC<UndoStripProps> = memo(({id, colors, onUndo, edgeToEdge, rowHeight}) => {
  const {t} = useTranslation();
  // Say it out loud: the strip appears where the row was, and a screen-reader
  // user would otherwise never learn Undo exists (M29).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(t('transaction.deletedAnnounce'));
  }, [t]);
  return (
    <View style={gs.mb5}>
      <View
        testID="undo-card"
        style={[
          gs.rounded12,
          gs.rowBetweenCenter,
          gs.px14,
          // Built like a row (10 pt around a 36 pt control) when no height was measured.
          gs.py10,
          edgeToEdge && gs.mx16,
          rowHeight ? {height: rowHeight} : undefined,
          {backgroundColor: colors.secondaryAccent},
        ]}>
        <PrimaryText size={13} color={colors.secondaryText}>
          {t('transaction.deleted')}
        </PrimaryText>
        <TouchableOpacity
          onPress={() => onUndo(id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          hitSlop={UNDO_HIT_SLOP}
          style={[gs.px14, gs.rounded10, styles.undo, {backgroundColor: colors.accentGreen}]}>
          <PrimaryText size={12} weight="semibold" color={colors.buttonText}>
            {t('common.undo')}
          </PrimaryText>
        </TouchableOpacity>
      </View>
    </View>
  );
});

UndoStrip.displayName = 'UndoStrip';

// Drawn as tall as the row's icon (36 pt); the slop keeps the 44 pt target (M30).
const UNDO_HIT_SLOP = {top: 6, bottom: 6, left: 8, right: 8};

const styles = StyleSheet.create({
  undo: {height: 36, justifyContent: 'center'},
});
