import React from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {CustomInput} from '../../../ui/atoms/CustomInput';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs} from '../../../ui/globalStyles';
import {MIN_PASSPHRASE_LENGTH, passphraseProblem} from '../lib/passphrase';

interface PassphraseFieldsProps {
  first: string;
  setFirst: (value: string) => void;
  second: string;
  setSecond: (value: string) => void;
  disabled?: boolean;
}

/** The passphrase typed twice, hidden, with what is wrong once the second is being typed. */
export const PassphraseFields: React.FC<PassphraseFieldsProps> = ({first, setFirst, second, setSecond, disabled}) => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const problem = second.length > 0 ? passphraseProblem(first, second) : null;
  return (
    <View>
      <CustomInput
        colors={colors}
        input={first}
        setInput={setFirst}
        placeholder={t('autoBackup.passphraseLabel')}
        label={t('autoBackup.passphraseLabel')}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="next"
        disabled={disabled}
      />
      <CustomInput
        colors={colors}
        input={second}
        setInput={setSecond}
        placeholder={t('autoBackup.passphraseAgainLabel')}
        label={t('autoBackup.passphraseAgainLabel')}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="done"
        disabled={disabled}
      />
      {problem ? (
        <PrimaryText size={12} color={colors.accentRed} style={gs.mb10} accessibilityLiveRegion="polite">
          {problem === 'tooShort'
            ? t('autoBackup.passphraseTooShort', {count: MIN_PASSPHRASE_LENGTH})
            : t('autoBackup.passphraseMismatch')}
        </PrimaryText>
      ) : null}
    </View>
  );
};
