import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import DebtorEntry from '../../components/molecules/DebtorEntry';
import {RecordGate} from '../../components/molecules/RecordGate';
import {useRecord} from '../../hooks/useRecord';
import {getDebtorByDebtorId} from '../../watermelondb/services';
import type {HomeStackParamList} from '../../navigation/types';

const UpdateDebtorScreen = () => {
  const {debtorId} = useRoute<RouteProp<HomeStackParamList, 'UpdateDebtorScreen'>>().params;
  const state = useRecord(debtorId, getDebtorByDebtorId);
  return <RecordGate state={state}>{debtor => <DebtorEntry editing={debtor} />}</RecordGate>;
};

export default UpdateDebtorScreen;
