import React from 'react';
import {View} from 'react-native';
import {PrimaryText} from './PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';

interface StatusChipProps {
  label: string;
  /** 'attention': something waits for the user. 'good': it is as it should be. */
  tone?: 'attention' | 'good' | 'neutral';
}

/**
 * A short state in words, with a dot for its tone. The words carry the
 * meaning; the dot only repeats it, so colour is never the one signal
 * (UX revamp v2: "amber only for what needs a decision").
 */
export const StatusChip = React.memo(({label, tone = 'neutral'}: StatusChipProps) => {
  const colors = useThemeColors();
  const dot = tone === 'attention' ? colors.accentOrange : tone === 'good' ? colors.accentGreen : colors.secondaryText;
  return (
    <View style={[gs.rowCenter, gs.gap6, gs.px8, gs.py3, gs.rounded8, {backgroundColor: colors.secondaryAccent}]}>
      <View style={[gs.size6, gs.roundedFull, {backgroundColor: dot}]} />
      <PrimaryText size={11} weight="semibold" numberOfLines={1}>
        {label}
      </PrimaryText>
    </View>
  );
});
