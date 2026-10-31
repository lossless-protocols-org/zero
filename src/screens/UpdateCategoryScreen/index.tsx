import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import CategoryEntry from '../../components/molecules/CategoryEntry';
import {RecordGate} from '../../components/molecules/RecordGate';
import {useRecord} from '../../hooks/useRecord';
import {getCategoryById} from '../../watermelondb/services';
import type {HomeStackParamList} from '../../navigation/types';

const UpdateCategoryScreen = () => {
  const {categoryId} = useRoute<RouteProp<HomeStackParamList, 'UpdateCategoryScreen'>>().params;
  const state = useRecord(categoryId, getCategoryById);
  return <RecordGate state={state}>{category => <CategoryEntry editing={category} />}</RecordGate>;
};

export default UpdateCategoryScreen;
