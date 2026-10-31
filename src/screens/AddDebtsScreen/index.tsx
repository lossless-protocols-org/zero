import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import DebtEntry from '../../components/molecules/DebtEntry';
import {RecordGate} from '../../components/molecules/RecordGate';
import {useRecord} from '../../hooks/useRecord';
import {getDebtorByDebtorId} from '../../watermelondb/services';
import type {HomeStackParamList} from '../../navigation/types';

const AddDebtsScreen = () => {
  const {debtorId} = useRoute<RouteProp<HomeStackParamList, 'AddDebtsScreen'>>().params;
  const state = useRecord(debtorId, getDebtorByDebtorId);
  return (
    <RecordGate state={state}>
      {debtor => <DebtEntry debtor={{debtorId: debtor.id, debtorName: debtor.title}} />}
    </RecordGate>
  );
};

export default AddDebtsScreen;
