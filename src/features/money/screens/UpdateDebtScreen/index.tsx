import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import {DebtEntry} from '../../components/DebtEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getDebtById} from '../../../../data/services/debtService';
import {getDebtorByDebtorId} from '../../../../data/services/debtorService';
import type {DebtData} from '../../../../domain/types';
import type {HomeStackParamList} from '../../../../navigation/types';

/** The debt and the name of its person; null when either is gone. */
const loadDebtWithDebtor = async (debtId: string): Promise<{debt: DebtData; debtorName: string} | null> => {
  const debt = await getDebtById(debtId);
  const debtor = debt ? await getDebtorByDebtorId(debt.debtorId) : null;
  return debt && debtor ? {debt, debtorName: debtor.title} : null;
};

export const UpdateDebtScreen = () => {
  const {debtId} = useRoute<RouteProp<HomeStackParamList, 'UpdateDebtScreen'>>().params;
  const state = useRecord(debtId, loadDebtWithDebtor);
  return (
    <RecordGate state={state}>
      {({debt, debtorName}) => <DebtEntry debtor={{debtorId: debt.debtorId, debtorName}} editing={debt} />}
    </RecordGate>
  );
};
