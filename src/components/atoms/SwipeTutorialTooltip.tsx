import React from 'react';
import {View} from 'react-native';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {useTranslation} from 'react-i18next';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import useThemeColors from '../../hooks/useThemeColors';
import PrimaryText from './PrimaryText';
import Icon from './Icons';
import {gs, hitSlop} from '../../styles/globalStyles';

interface SwipeTutorialTooltipProps {
  onDismiss: () => void;
}

const SwipeTutorialTooltip: React.FC<SwipeTutorialTooltipProps> = ({onDismiss}) => {
  const colors = useThemeColors();
  const {t} = useTranslation();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[gs.mx16, gs.mb10, gs.rounded12, gs.p14, gs.rowBetweenCenter, {backgroundColor: colors.accentGreen}]}>
      <View style={[gs.rowCenter, gs.flex1, gs.mr10]}>
        <Icon name="arrow-left-right" size={16} color={colors.buttonText} />
        <PrimaryText size={13} weight="medium" color={colors.buttonText} style={gs.ml8}>
          {t('tutorial.swipeHint')}
        </PrimaryText>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        activeOpacity={0.7}
        accessibilityRole="button"
        // The pill is ~24 dp tall; the slop brings the target past 44 pt (M30).
        hitSlop={hitSlop}
        style={[gs.px12, gs.py5, gs.rounded8, {backgroundColor: colors.buttonText}]}>
        <PrimaryText size={12} weight="semibold" color={colors.accentGreen}>
          {t('tutorial.gotIt')}
        </PrimaryText>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default React.memo(SwipeTutorialTooltip);
