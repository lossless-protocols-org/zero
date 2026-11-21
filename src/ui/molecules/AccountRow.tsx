import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../atoms/PrimaryText';
import {Icon} from '../atoms/Icons';
import {useThemeColors} from '../hooks/useThemeColors';
import {displayAccountName} from '../../i18n/displayNames';
import type {AccountSummary} from '../../data/services/accountService';
import {gs} from '../globalStyles';

interface AccountRowProps {
  shown: boolean;
  selected: AccountSummary | undefined;
  pick: () => void;
  /** What the row says when nothing is selected (a debt's "No account"); without it, no row. */
  emptyLabel?: string;
}

/**
 * The collapsed account row of an entry form (3.0, Pro): the account the
 * entry goes to, already filled in. Nothing to tap unless the user wants a
 * different one, so adding an entry takes the same taps with or without it.
 * Renders nothing when `shown` is false (Free, or one active account).
 */
export const AccountRow: React.FC<AccountRowProps> = ({shown, selected, pick, emptyLabel}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  if (!shown || (!selected && emptyLabel === undefined)) {
    return null;
  }
  const name = selected ? displayAccountName(selected.name, t) : (emptyLabel ?? '');
  return (
    <TouchableOpacity
      onPress={pick}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={t('accounts.rowA11y', {name: t('accounts.rowLabel'), amount: name})}
      style={[gs.minTouch, gs.mb15]}>
      <View style={gs.rowBetweenCenter}>
        <PrimaryText size={12} color={colors.secondaryText}>
          {t('accounts.rowLabel')}
        </PrimaryText>
        <View style={[gs.rowCenter, gs.gap10]}>
          {selected ? (
            <Icon dynamicName={selected.icon} size={16} color={selected.color || colors.primaryText} />
          ) : null}
          <PrimaryText size={14} weight="medium">
            {name}
          </PrimaryText>
          <Icon name="chevron-right" size={16} color={colors.secondaryText} />
        </View>
      </View>
    </TouchableOpacity>
  );
};
