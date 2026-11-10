import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import {DebtEntry} from '../../components/DebtEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getDebtorByDebtorId} from '../../../../data/services/debtorService';
import type {HomeStackParamList} from '../../../../navigation/types';

export const AddDebtsScreen = () => {
  const {debtorId} = useRoute<RouteProp<HomeStackParamList, 'AddDebtsScreen'>>().params;
  const state = useRecord(debtorId, getDebtorByDebtorId);
  return (
    <RecordGate state={state}>
      {debtor => <DebtEntry debtor={{debtorId: debtor.id, debtorName: debtor.title}} />}
    </RecordGate>
  );
};
