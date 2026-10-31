import React from 'react';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import ExpenseEntry from '../../components/molecules/ExpenseEntry';
import {RecordGate} from '../../components/molecules/RecordGate';
import {useRecord} from '../../hooks/useRecord';
import {getExpenseById} from '../../watermelondb/services';
import type {HomeStackParamList} from '../../navigation/types';

const UpdateTransactionScreen = () => {
  const {expenseId} = useRoute<RouteProp<HomeStackParamList, 'UpdateTransactionScreen'>>().params;
  const state = useRecord(expenseId, getExpenseById);
  return <RecordGate state={state}>{expense => <ExpenseEntry editing={expense} />}</RecordGate>;
};

export default UpdateTransactionScreen;
