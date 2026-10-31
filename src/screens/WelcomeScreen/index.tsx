import {View} from 'react-native';
import React from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import Carousel from '../../components/atoms/Carousel';
import useWelcome from './useWelcome';
import {gs} from '../../styles/globalStyles';
import {logRejection} from '../../utils/errorLog';

const WelcomeScreen = () => {
  const {colors, isBusy, handleAlreadyUser, handleNewUser} = useWelcome();
  const {t} = useTranslation();

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween}>
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
    </PrimaryView>
  );
};

export default WelcomeScreen;
