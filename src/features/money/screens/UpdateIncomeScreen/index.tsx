import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {IncomeEntry} from '../../components/IncomeEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getIncomeById} from '../../../../data/services/incomeService';
import type {HomeStackParamList} from '../../../../navigation/types';

export const UpdateIncomeScreen = () => {
  const {incomeId} = useRoute<RouteProp<HomeStackParamList, 'UpdateIncomeScreen'>>().params;
  const state = useRecord(incomeId, getIncomeById);
  return <RecordGate state={state}>{income => <IncomeEntry editing={income} />}</RecordGate>;
};
