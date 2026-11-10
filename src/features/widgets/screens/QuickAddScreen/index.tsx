import React, {useMemo} from 'react';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '../../../../navigation/types';
import {QuickAddSheet} from '../../quickAdd/QuickAddSheet';
import type {QuickAddHost} from '../../quickAdd/host';

/**
 * The quick-add sheet inside the app (2.8): a transparent screen over whatever
 * was open, reached by zero://quick links. On iOS this is where the widget's
 * "+", "Money in" and category chips land, since a widget can only open the
 * app; Android's widget uses its own window over the home screen instead.
 * Deep links are enabled only after onboarding, so the sheet is always ready.
 */
export const QuickAddScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const {kind, categoryId, amount, title} = useRoute<RouteProp<HomeStackParamList, 'QuickAddScreen'>>().params ?? {};
  // "Add again" from the Home Screen quick actions: filled in, one tap from Save (as Android's).
  const prefill = useMemo(() => (amount ? {amount, text: title ?? ''} : undefined), [amount, title]);

  const host = useMemo<QuickAddHost>(
    () => ({
      close: () => navigation.goBack(),
      openFull: next =>
        next === 'income' ? navigation.replace('AddIncomeScreen', {}) : navigation.replace('AddTransactionsScreen'),
      dimLeaving: () => undefined,
      drawsScrim: true,
    }),
    [navigation],
  );

  return (
    <QuickAddSheet
      kind={kind === 'income' ? 'income' : 'expense'}
      categoryId={categoryId ?? ''}
      ready
      host={host}
      prefill={prefill}
    />
  );
};
