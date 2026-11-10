import {useCallback, useMemo} from 'react';
import type {AccessibilityActionEvent} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import type {IconName} from '../atoms/IconRegistry';

/**
 * A row action besides edit and delete (Got money back, Move up…). It is never
 * a swipe target: it appears in the long-press menu and as a screen-reader
 * action, so it stays reachable in both swipe modes.
 */
export interface RowExtraAction {
  /** Stable id, also the accessibility action name. */
  name: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

interface RowActionsInput {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  menuTitle?: string;
  extraActions?: readonly RowExtraAction[];
}

/**
 * What can be done to a row (edit, delete, the extras) and the two ways
 * besides a swipe to do it: screen-reader actions on the row, and the
 * long-press menu (SwipeableRow).
 */
export const useRowActions = ({onEdit, onDelete, editLabel, deleteLabel, menuTitle, extraActions}: RowActionsInput) => {
  const {t} = useTranslation();

  /**
   * Accessibility actions are the ONLY way a screen-reader user can reach edit
   * and delete. The action buttons behind the row are labelled, but they are
   * revealed by a pan gesture that TalkBack and VoiceOver intercept, so
   * without this the rows were read-only for anyone using one — in an app
   * where swipe is the sole affordance for both operations.
   *
   * With this, VoiceOver exposes them via the rotor's Actions and TalkBack via
   * its local context menu.
   */
  const accessibilityActions = useMemo(() => {
    const actions: Array<{name: string; label: string}> = [];
    if (onEdit) {
      actions.push({name: 'edit', label: editLabel ?? t('common.edit')});
    }
    if (onDelete) {
      actions.push({name: 'delete', label: deleteLabel ?? t('common.delete')});
    }
    for (const extra of extraActions ?? []) {
      actions.push({name: extra.name, label: extra.label});
    }
    return actions;
  }, [onEdit, onDelete, editLabel, deleteLabel, extraActions, t]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'edit') {
        onEdit?.();
      } else if (name === 'delete') {
        onDelete?.();
      } else {
        extraActions?.find(extra => extra.name === name)?.onPress();
      }
    },
    [onEdit, onDelete, extraActions],
  );

  // Swipe off (Settings → "Swipe to edit or delete"): the same two actions
  // sit behind a long-press menu, so nothing can be deleted by a stray drag.
  const openMenu = useCallback(() => {
    if (!onEdit && !onDelete && !extraActions?.length) {
      return;
    }
    void SheetManager.show('row-actions-sheet', {
      payload: {
        title: menuTitle ?? t('common.moreActions'),
        editLabel: editLabel ?? t('common.edit'),
        deleteLabel: deleteLabel ?? t('common.delete'),
        onEdit,
        onDelete,
        extraActions,
      },
    });
  }, [onEdit, onDelete, extraActions, menuTitle, editLabel, deleteLabel, t]);

  return {accessibilityActions, onAccessibilityAction: handleAccessibilityAction, openMenu};
};
