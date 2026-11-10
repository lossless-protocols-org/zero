import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {ExpenseEntry} from '../../components/ExpenseEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getExpenseById} from '../../../../data/services/expenseService';
import type {HomeStackParamList} from '../../../../navigation/types';

export const UpdateTransactionScreen = () => {
  const {expenseId} = useRoute<RouteProp<HomeStackParamList, 'UpdateTransactionScreen'>>().params;
  const state = useRecord(expenseId, getExpenseById);
  return <RecordGate state={state}>{expense => <ExpenseEntry editing={expense} />}</RecordGate>;
};
