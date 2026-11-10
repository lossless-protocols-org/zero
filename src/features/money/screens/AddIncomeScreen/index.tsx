import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {IncomeEntry} from '../../components/IncomeEntry';
import type {HomeStackParamList} from '../../../../navigation/types';

export const AddIncomeScreen = () => {
  const yearMonth = useRoute<RouteProp<HomeStackParamList, 'AddIncomeScreen'>>().params?.yearMonth;
  return <IncomeEntry yearMonth={yearMonth} />;
};
