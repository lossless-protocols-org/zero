import {View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../../../../ui/atoms/PrimaryView';
import {FormScroll} from '../../../../ui/atoms/FormScroll';
import {PrimaryText} from '../../../../ui/atoms/PrimaryText';
import {PrimaryButton} from '../../../../ui/atoms/PrimaryButton';
import {Carousel} from '../../components/Carousel';
import {useWelcome} from './useWelcome';
import {gs} from '../../../../ui/globalStyles';
import {logRejection} from '../../../../platform/errorLog';

export const WelcomeScreen = () => {
  const {colors, isBusy, handleAlreadyUser, handleNewUser} = useWelcome();
  const {t} = useTranslation();

  return (
    <PrimaryView colors={colors}>
      <FormScroll contentStyle={gs.justifyBetween}>
        <View style={gs.pt15p}>
          <PrimaryText size={28} weight="bold" color={colors.primaryText}>
            {t('welcome.title')}{' '}
            <PrimaryText size={28} weight="bold" color={colors.accentGreen}>
              zero
            </PrimaryText>
          </PrimaryText>
          <PrimaryText size={14} color={colors.secondaryText} style={gs.mt6}>
            {t('welcome.subtitle')}
          </PrimaryText>
        </View>

        <Carousel />

        <View style={gs.gap12}>
          <PrimaryButton
            onPress={() => logRejection(handleNewUser())}
            colors={colors}
            buttonTitle={t('common.getStarted')}
            loading={isBusy}
          />
          <PrimaryButton
            onPress={handleAlreadyUser}
            colors={colors}
            buttonTitle={t('backup.iHaveBackup')}
            variant="outline"
          />
        </View>
      </FormScroll>
    </PrimaryView>
  );
};
