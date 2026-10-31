import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import DebtEntry from '../../components/molecules/DebtEntry';
import {RecordGate} from '../../components/molecules/RecordGate';
import {useRecord} from '../../hooks/useRecord';
import {getDebtById, getDebtorByDebtorId, type DebtData} from '../../watermelondb/services';
import type {HomeStackParamList} from '../../navigation/types';

/** The debt and the name of its person; null when either is gone. */
const loadDebtWithDebtor = async (debtId: string): Promise<{debt: DebtData; debtorName: string} | null> => {
  const debt = await getDebtById(debtId);
  const debtor = debt ? await getDebtorByDebtorId(debt.debtorId) : null;
  return debt && debtor ? {debt, debtorName: debtor.title} : null;
};

const UpdateDebtScreen = () => {
  const {debtId} = useRoute<RouteProp<HomeStackParamList, 'UpdateDebtScreen'>>().params;
  const state = useRecord(debtId, loadDebtWithDebtor);
  return (
    <RecordGate state={state}>
      {({debt, debtorName}) => <DebtEntry debtor={{debtorId: debt.debtorId, debtorName}} editing={debt} />}
    </RecordGate>
  );
};

export default UpdateDebtScreen;
