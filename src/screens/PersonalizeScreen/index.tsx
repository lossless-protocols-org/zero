import {TouchableOpacity, View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import usePersonalize from './usePersonalize';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import CustomInput from '../../components/atoms/CustomInput';
import {gs} from '../../styles/globalStyles';
import {logRejection} from '../../utils/errorLog';

const PersonalizeScreen = () => {
  const {colors, setName, name, handleSubmit, handleSkip, nameSchema} = usePersonalize();
  const {t} = useTranslation();
  const isValid = nameSchema.safeParse(name).success;

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween} dismissKeyboardOnTouch>
      <View>
        <TouchableOpacity
          style={[gs.selfEnd, gs.mt5p, gs.minTouch, gs.px10]}
          onPress={handleSkip}
          accessibilityRole="button">
          <PrimaryText size={13} weight="medium" color={colors.secondaryText}>
            {t('common.skip')}
          </PrimaryText>
        </TouchableOpacity>

        <View style={gs.pt15p}>
          <PrimaryText size={28} weight="bold">
            {t('personalize.title')}
          </PrimaryText>
          <PrimaryText size={28} weight="bold">
            {t('personalize.titleSuffix')}
          </PrimaryText>
        </View>

        <PrimaryText size={14} color={colors.secondaryText} style={gs.mt6}>
          {t('personalize.subtitle')}
        </PrimaryText>

        <View style={gs.mt30}>
          <CustomInput
            input={name}
            label={t('personalize.nameLabel')}
            colors={colors}
            placeholder={t('personalize.namePlaceholder')}
            setInput={setName}
            schema={nameSchema}
          />
        </View>
      </View>
      <PrimaryButton
        onPress={() => logRejection(handleSubmit())}
        colors={colors}
        buttonTitle={t('common.continue')}
        disabled={!isValid}
      />
    </PrimaryView>
  );
};

export default PersonalizeScreen;
