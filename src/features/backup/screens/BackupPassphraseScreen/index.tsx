import React, {useState} from 'react';
import {ScrollView, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {AppHeader} from '../../../../ui/atoms/AppHeader';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {goBack} from '../../../../platform/navigationUtils';
import {logRejection} from '../../../../platform/errorLog';
import {gs} from '../../../../ui/globalStyles';
import {useAutoBackup} from '../../hooks/useAutoBackup';
import {PassphraseFields} from '../../components/PassphraseFields';
import {passphraseProblem} from '../../lib/passphrase';

/** A new passphrase for the automatic backup (3.0, plan P10); today's backup is written again with it. */
export const BackupPassphraseScreen = () => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const backup = useAutoBackup();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  return (
    <PrimaryView colors={colors}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={gs.pb80}>
        <View style={[gs.mb20, gs.mt20]}>
          <AppHeader onPress={goBack} colors={colors} text={t('autoBackup.changePassphraseTitle')} />
        </View>
        <PrimaryText size={13} color={colors.secondaryText} style={gs.mb10}>
          {t('autoBackup.changePassphraseHint')}
        </PrimaryText>
        <PrimaryText size={13} color={colors.secondaryText} style={gs.mb20}>
          {t('autoBackup.passphraseHint')}
        </PrimaryText>
        <PassphraseFields
          first={first}
          setFirst={setFirst}
          second={second}
          setSecond={setSecond}
          disabled={backup.busy !== 'none'}
        />
        <PrimaryButton
          onPress={() => logRejection(backup.changePassphrase(first))}
          colors={colors}
          buttonTitle={t('autoBackup.save')}
          loading={backup.busy === 'passphrase'}
          disabled={passphraseProblem(first, second) !== null || backup.busy !== 'none'}
        />
      </ScrollView>
    </PrimaryView>
  );
};
