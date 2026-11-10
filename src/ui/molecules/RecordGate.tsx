import React from 'react';
import {View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PrimaryView} from '../atoms/PrimaryView';
import {AppHeader} from '../atoms/AppHeader';
import {PrimaryText} from '../atoms/PrimaryText';
import {useThemeColors} from '../hooks/useThemeColors';
import type {RecordState} from '../hooks/useRecord';
import {goBack} from '../../platform/navigationUtils';
import {gs} from '../globalStyles';

interface RecordGateProps<T> {
  state: RecordState<T>;
  children: (record: T) => React.ReactElement;
}

/** Renders `children` once the row is read; a loader before, and a way back if it is gone or unreadable. */
export const RecordGate = <T,>({state, children}: RecordGateProps<T>): React.ReactElement => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  if (state.status === 'ready') {
    return children(state.record);
  }
  if (state.status === 'loading') {
    // A local read, normally done within a frame or two: a blank screen, not a loader flash.
    return <PrimaryView colors={colors} />;
  }
  return (
    <PrimaryView colors={colors}>
      <View style={[gs.mb20, gs.mt20]}>
        <AppHeader onPress={goBack} colors={colors} text="" />
      </View>
      <PrimaryText size={14} color={colors.secondaryText}>
        {state.status === 'missing' ? t('common.recordMissing') : t('common.recordLoadFailed')}
      </PrimaryText>
    </PrimaryView>
  );
};
