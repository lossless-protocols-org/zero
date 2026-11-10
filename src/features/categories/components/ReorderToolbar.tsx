import React from 'react';
import {View} from 'react-native';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {gs, hitSlop} from '../../../ui/globalStyles';
import type {ThemeColors} from '../../../ui/hooks/useThemeColors';

type Props = {
  reordering: boolean;
  /** False with fewer than two categories: nothing to reorder, no button. */
  canReorder: boolean;
  onToggle: () => void;
  colors: ThemeColors;
};

/**
 * The row above the category list: the drag hint while reordering, and the
 * Reorder / Done button. Out of reorder mode the hint's place is an empty
 * spacer, not an empty text: VoiceOver kept a blank text element there with
 * no description (iOS accessibility audit, iPhone 2026-11-09). With nothing
 * to reorder (Free's one income category) it takes no space at all: its empty
 * touch-height row left a gap above "Salary" (owner, 2026-11-09).
 */
export const ReorderToolbar = ({reordering, canReorder, onToggle, colors}: Props) => {
  const {t} = useTranslation();
  if (!canReorder && !reordering) {
    return null;
  }
  return (
    <View style={[gs.rowBetweenCenter, gs.mb8, gs.minTouch]}>
      {reordering ? (
        <PrimaryText size={12} color={colors.secondaryText} style={gs.flex1}>
          {t('categories.reorderHint')}
        </PrimaryText>
      ) : (
        <View style={gs.flex1} />
      )}
      {canReorder ? (
        <TouchableOpacity
          onPress={onToggle}
          hitSlop={hitSlop}
          accessibilityRole="button"
          style={[gs.px12, gs.py5, gs.roundedFull, {backgroundColor: colors.secondaryAccent}]}>
          <PrimaryText size={12} weight="semibold">
            {reordering ? t('categories.reorderDone') : t('categories.reorder')}
          </PrimaryText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
