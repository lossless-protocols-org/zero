import {TouchableOpacity, View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {usePersonalize} from './usePersonalize';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {CustomInput} from '../../../../ui/atoms/CustomInput';
import {gs} from '../../../../ui/globalStyles';
import {logRejection} from '../../../../platform/errorLog';

export const PersonalizeScreen = () => {
  const {colors, setName, name, handleSubmit, handleSkip, nameSchema} = usePersonalize();
  const {t} = useTranslation();
  const isValid = nameSchema.isValid(name);

  return (
    <PrimaryView colors={colors}>
      <FormScroll contentStyle={gs.justifyBetween}>
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
      </FormScroll>
    </PrimaryView>
  );
};
