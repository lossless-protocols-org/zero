import React, {useState} from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {useAccountGroups} from '../../../../ui/hooks/useAccountGroups';
import {useDialog} from '../../../../ui/context/DialogContext';
import {goBack} from '../../../../platform/navigationUtils';
import {appendErrorLog, logRejection} from '../../../../platform/errorLog';
import {ACCOUNT_KIND_MAX, cleanAccountKind, isValidAccountKind} from '../../../../domain/accounts';
import type {HomeStackParamList} from '../../../../navigation/types';
import {CLASS_LABEL} from '../../../../ui/accountWords';
import {gs} from '../../../../ui/globalStyles';

/**
 * Renames one group of accounts (Categories tab, Accounts): one word, and
 * every account of that class in the group takes it. Groups are made on the
 * account form, never here.
 */
export const GroupFormScreen = () => {
  const {accountClass, groupKey} = useRoute<RouteProp<HomeStackParamList, 'GroupFormScreen'>>().params;
  const {t} = useTranslation();
  const colors = useThemeColors();
  const {showAlert} = useDialog();
  const {ready, byClass, rename} = useAccountGroups();
  const group = byClass[accountClass].find(found => found.key === groupKey);
  // null until the user types: the field then shows the group's own word, which arrives after the first read.
  const [typed, setTyped] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const word = typed ?? group?.label ?? '';
  const clean = cleanAccountKind(word);
  const canSave = ready && group !== undefined && clean !== '' && isValidAccountKind(clean) && clean !== group.label;

  const save = async (): Promise<void> => {
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    try {
      await rename(accountClass, group, clean);
      goBack();
    } catch (error) {
      appendErrorLog(error, false);
      setSaving(false);
      await showAlert({type: 'error', message: t('accounts.saveFailed')});
    }
  };

  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader
          onPress={goBack}
          colors={colors}
          text={t('accounts.groupRenameTitle')}
          subtitle={t(CLASS_LABEL[accountClass])}
        />
      </View>
      <CustomInput
        colors={colors}
        input={word}
        setInput={setTyped}
        placeholder={t('accounts.kindPlaceholder')}
        label={t('accounts.groupNameLabel')}
        maxLength={ACCOUNT_KIND_MAX}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => logRejection(save())}
      />
      <View style={gs.mt5}>
        <PrimaryButton
          onPress={() => logRejection(save())}
          colors={colors}
          buttonTitle={t('common.update')}
          disabled={!canSave || saving}
        />
      </View>
    </PrimaryView>
  );
};
