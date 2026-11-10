import React, {useCallback} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {Icon} from '../../../ui/atoms/Icons';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {usePreference} from '../../../ui/hooks/usePreference';
import {listSortPreference, type ListSort} from '../listSort';
import {gs, hitSlop} from '../../../ui/globalStyles';

/** A sort option's name ("Date", "Category", …). */
export const useListSortLabel = (): ((sort: ListSort) => string) => {
  const {t} = useTranslation();
  return useCallback(
    (sort: ListSort) =>
      sort === 'date'
        ? t('listSort.date')
        : sort === 'category'
          ? t('listSort.category')
          : sort === 'title'
            ? t('listSort.titleOption')
            : t('listSort.amount'),
    [t],
  );
};

/**
 * "Sort: Date ⇅" over a spending list (2.8, bug sheet #2); opens the "Sort by" sheet.
 * `spaced`: the list starts with a row, not a day or category heading (Title and
 * Amount are one list), so the chip keeps the gap a heading's top margin gives.
 */
export const SortChip: React.FC<{edgeToEdge?: boolean; spaced?: boolean}> = ({edgeToEdge = false, spaced = false}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const sort = usePreference(listSortPreference);
  const label = useListSortLabel();
  const text = t('listSort.chip', {sort: label(sort)});

  return (
    <View style={[gs.row, gs.justifyEnd, gs.mt10, spaced && gs.mb12, edgeToEdge && gs.px16]}>
      <TouchableOpacity
        onPress={() => {
          void SheetManager.show('list-sort-sheet');
        }}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={text}
        style={[gs.rowCenter, gs.gap6, gs.px12, gs.py5, gs.roundedFull, {backgroundColor: colors.secondaryAccent}]}>
        <Icon name="arrow-up-down" size={14} color={colors.secondaryText} />
        <PrimaryText size={12} weight="medium" color={colors.secondaryText}>
          {text}
        </PrimaryText>
      </TouchableOpacity>
    </View>
  );
};
