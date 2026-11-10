import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {DebtorEntry} from '../../components/DebtorEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getDebtorByDebtorId} from '../../../../data/services/debtorService';
import type {HomeStackParamList} from '../../../../navigation/types';

export const UpdateDebtorScreen = () => {
  const {debtorId} = useRoute<RouteProp<HomeStackParamList, 'UpdateDebtorScreen'>>().params;
  const state = useRecord(debtorId, getDebtorByDebtorId);
  return <RecordGate state={state}>{debtor => <DebtorEntry editing={debtor} />}</RecordGate>;
};
