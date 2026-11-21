import React, {useState} from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {IncomeEntry} from '../../components/IncomeEntry';
import type {HomeStackParamList} from '../../../../navigation/types';
import {takeIncomeDraft} from '../../../../ui/quickAddDraft';

export const AddIncomeScreen = () => {
  const yearMonth = useRoute<RouteProp<HomeStackParamList, 'AddIncomeScreen'>>().params?.yearMonth;
  // What reconcile filled in ("Record what's missing"), once.
  const [draft] = useState(takeIncomeDraft);
  return <IncomeEntry yearMonth={yearMonth} draft={draft ?? undefined} />;
};
