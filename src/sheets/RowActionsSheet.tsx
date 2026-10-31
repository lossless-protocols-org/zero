import {TouchableOpacity, View} from 'react-native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps} from 'react-native-actions-sheet';
import useThemeColors from '../hooks/useThemeColors';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import PrimaryText from '../components/atoms/PrimaryText';
import Icon from '../components/atoms/Icons';
import {gs} from '../styles/globalStyles';

/**
 * Edit / Delete for a list row when swipe actions are turned off (Settings).
 * Opened by a long-press on the row; the swipe gesture no longer exists in
 * that mode, so this is the only visible path to both operations.
 */
const RowActionsSheet: React.FC<SheetProps<'row-actions-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {title, onEdit, onDelete, editLabel, deleteLabel} = props.payload ?? {};

  const run = useCallback(
    (action?: () => void) => {
      void SheetManager.hide(props.sheetId);
      // Let the sheet finish closing before a dialog or navigation starts.
      setTimeout(() => action?.(), 250);
    },
    [props.sheetId],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: title ?? '',
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {onEdit ? (
          <TouchableOpacity
            onPress={() => run(onEdit)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={editLabel ?? t('common.edit')}
            style={[gs.rowCenter, gs.gap12, gs.py12]}>
            <View style={[gs.size36, gs.roundedFull, gs.center, {backgroundColor: colors.lightAccent}]}>
              <Icon name="pencil" size={16} color={colors.accentGreen} />
            </View>
            <PrimaryText size={15} weight="medium">
              {editLabel ?? t('common.edit')}
            </PrimaryText>
          </TouchableOpacity>
        ) : null}
        {onDelete ? (
          <TouchableOpacity
            onPress={() => run(onDelete)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel ?? t('common.delete')}
            style={[gs.rowCenter, gs.gap12, gs.py12]}>
            <View style={[gs.size36, gs.roundedFull, gs.center, {backgroundColor: colors.lightAccent}]}>
              <Icon name="trash-2" size={16} color={colors.accentOrange} />
            </View>
            <PrimaryText size={15} weight="medium" color={colors.accentOrange}>
              {deleteLabel ?? t('common.delete')}
            </PrimaryText>
          </TouchableOpacity>
        ) : null}
      </View>
    </CustomBottomSheet>
  );
});

export default RowActionsSheet;
