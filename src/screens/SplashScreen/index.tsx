import React from 'react';
import {useTranslation} from 'react-i18next';
import PrimaryButton from '../../components/atoms/PrimaryButton';
import useSplash from './useSplash';
import PrimaryView from '../../components/atoms/PrimaryView';
import PrimaryText from '../../components/atoms/PrimaryText';
import {View} from 'react-native';
import {gs} from '../../styles/globalStyles';

const SplashScreen = () => {
  const {handleClick, colors} = useSplash();
  const {t} = useTranslation();

  return (
    <PrimaryView colors={colors} style={gs.justifyBetween}>
      <View style={gs.pt20p}>
        <PrimaryText size={72} weight="bold" color={colors.primaryText}>
          zero
        </PrimaryText>
        <View style={gs.mt10}>
          <PrimaryText size={18} color={colors.secondaryText}>
            {t('splash.tagline')}
          </PrimaryText>
          <PrimaryText size={18} color={colors.secondaryText} style={gs.opacity50}>
            {t('splash.taglineSuffix')}
          </PrimaryText>
        </View>
      </View>
      <PrimaryButton onPress={handleClick} colors={colors} buttonTitle={t('common.getStarted')} />
    </PrimaryView>
  );
};

export default SplashScreen;
