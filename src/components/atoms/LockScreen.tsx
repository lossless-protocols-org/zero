import React, {useEffect, useRef} from 'react';
import {Animated, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryView from './PrimaryView';
import PrimaryText from './PrimaryText';
import Icon from './Icons';
import {useThemeColors} from '../../context/ThemeContext';
import {gs} from '../../styles/globalStyles';

interface LockScreenProps {
  onAuthenticate: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({onAuthenticate}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <PrimaryView colors={colors} style={gs.center}>
      <Animated.View style={[gs.itemsCenter, {opacity: fadeAnim}]}>
        <View style={[gs.size100, gs.roundedFull, gs.center, gs.mb20, {backgroundColor: colors.secondaryAccent}]}>
          <Icon name="fingerprint" size={50} color={colors.accentGreen} />
        </View>
        <PrimaryText size={40} weight="bold" color={colors.primaryText}>
          zero
        </PrimaryText>
        <PrimaryText size={16} color={colors.secondaryText} style={gs.mt10}>
          {t('settings.appLockPrompt')}
        </PrimaryText>
        
        <TouchableOpacity
          onPress={onAuthenticate}
          style={[
            gs.mt30,
            gs.py12,
            gs.px20,
            gs.rounded8,
            {backgroundColor: colors.accentGreen},
          ]}>
          <PrimaryText size={14} weight="semibold" color={colors.buttonText}>
            Tap to unlock
          </PrimaryText>
        </TouchableOpacity>
      </Animated.View>
    </PrimaryView>
  );
};

export default LockScreen;
