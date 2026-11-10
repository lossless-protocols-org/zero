import {TouchableOpacity, View} from 'react-native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {CustomBottomSheet} from '../../../ui/atoms/CustomBottomSheet';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {LIST_SORTS, listSortPreference, type ListSort} from '../listSort';
import {useListSortLabel} from '../components/SortChip';
import {gs} from '../../../ui/globalStyles';

/** "Sort by" (2.8): a tap applies the order and closes; the choice is kept (listSortPreference). */
export const ListSortSheet: React.FC<SheetProps<'list-sort-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const label = useListSortLabel();
  const current = listSortPreference.get();

  const choose = useCallback(
    (sort: ListSort) => {
      listSortPreference.set(sort);
      void SheetManager.hide(props.sheetId);
    },
    [props.sheetId],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('listSort.title'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb20, gs.pt5]} accessibilityRole="radiogroup">
        {LIST_SORTS.map(sort => (
          <TouchableOpacity
            key={sort}
            onPress={() => choose(sort)}
            activeOpacity={0.6}
            accessibilityRole="radio"
            accessibilityState={{checked: current === sort}}>
            <View style={[gs.rowBetweenCenter, gs.py12]}>
              <PrimaryText size={15} weight={current === sort ? 'semibold' : 'medium'}>
                {label(sort)}
              </PrimaryText>
              <View
                style={[
                  gs.size20,
                  gs.rounded10,
                  gs.border2,
                  gs.center,
                  {borderColor: current === sort ? colors.accentGreen : colors.secondaryText},
                ]}>
                {current === sort && <View style={[gs.size10, gs.rounded5, {backgroundColor: colors.accentGreen}]} />}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </CustomBottomSheet>
  );
});
