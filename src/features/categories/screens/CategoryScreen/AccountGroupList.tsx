import React from 'react';
import {ScrollView} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {ListSection} from '../../../../ui/molecules/ListSection';
import {ListRow} from '../../../../ui/molecules/ListRow';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAccountGroups} from '../../../../ui/hooks/useAccountGroups';
import {navigate} from '../../../../platform/navigationUtils';
import {ACCOUNT_CLASSES} from '../../../../domain/accounts';
import {CLASS_ICON, CLASS_LABEL} from '../../../../ui/accountWords';
import {gs} from '../../../../ui/globalStyles';

/**
 * The Accounts tab of Categories (Pro): the groups the user's accounts are
 * in, one section per class that has any, and a tap renames one. Groups are
 * made on the account form, so there is no add and no order to change here.
 * Mounted only while its tab is open, so a free user's Categories reads no account.
 */
export const AccountGroupList = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {ready, byClass} = useAccountGroups();
  const sections = ACCOUNT_CLASSES.flatMap(accountClass => {
    const inUse = byClass[accountClass].filter(group => group.count > 0);
    return inUse.length > 0 ? [{accountClass, inUse}] : [];
  });

  return (
    <ScrollView contentContainerStyle={[gs.px16, gs.pb100]} showsVerticalScrollIndicator={false}>
      <PrimaryText size={12} color={colors.secondaryText} style={gs.mb15}>
        {t('categories.groupsNote')}
      </PrimaryText>
      {ready && sections.length === 0 ? (
        <PrimaryText size={13} color={colors.secondaryText}>
          {t('categories.noAccounts')}
        </PrimaryText>
      ) : null}
      {sections.map(({accountClass, inUse}) => (
        <ListSection key={accountClass} title={t(CLASS_LABEL[accountClass])} style={gs.mb15}>
          {inUse.map(group => (
            <ListRow
              key={group.key}
              dynamicIcon={CLASS_ICON[accountClass]}
              title={group.label}
              subtitle={t('accounts.kindCount', {count: group.count})}
              onPress={() => navigate('GroupFormScreen', {accountClass, groupKey: group.key})}
              testID={`group-${accountClass}:${group.key}`}
            />
          ))}
        </ListSection>
      ))}
    </ScrollView>
  );
};
