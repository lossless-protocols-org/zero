import React, {useCallback} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import {CustomBottomSheet} from '../atoms/CustomBottomSheet';
import {PrimaryText} from '../atoms/PrimaryText';
import {Icon} from '../atoms/Icons';
import {useThemeColors} from '../hooks/useThemeColors';
import {displayAccountName} from '../../i18n/displayNames';
import {gs} from '../globalStyles';

/**
 * The account an entry goes to (3.0, Pro): one tap picks and closes. Lists
 * the user's active accounts only; an entry already on an archived one keeps
 * it unless the user picks another here.
 */
export const AccountPickerSheet: React.FC<SheetProps<'account-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {accounts = [], selectedId, onSelect, noneLabel} = props.payload ?? {};
  // A debt may move through no account: offered first, as id ''.
  const rows = noneLabel === undefined ? accounts : [{id: '', name: noneLabel, icon: '', color: ''}, ...accounts];

  const choose = useCallback(
    (id: string) => {
      onSelect?.(id);
      void SheetManager.hide(props.sheetId);
    },
    [onSelect, props.sheetId],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('accounts.pickTitle'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      <View style={[gs.px20, gs.pb10, gs.pt5]}>
        {rows.map(account => {
          const checked = account.id === selectedId;
          return (
            <TouchableOpacity
              key={account.id}
              onPress={() => choose(account.id)}
              activeOpacity={0.6}
              accessibilityRole="radio"
              accessibilityState={{checked}}>
              <View style={[gs.rowBetweenCenter, gs.py12]}>
                <View style={[gs.rowCenter, gs.gap10]}>
                  {account.id === '' ? null : (
                    <Icon dynamicName={account.icon} size={18} color={account.color || colors.primaryText} />
                  )}
                  <PrimaryText size={15} weight={checked ? 'semibold' : 'medium'}>
                    {account.id === '' ? account.name : displayAccountName(account.name, t)}
                  </PrimaryText>
                </View>
                {checked ? <Icon name="check" size={18} color={colors.accentGreen} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </CustomBottomSheet>
  );
});
