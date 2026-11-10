import React from 'react';
import {RouteProp, useRoute} from '@react-navigation/native';
import {CategoryEntry} from '../../components/CategoryEntry';
import {RecordGate} from '../../../../ui/molecules/RecordGate';
import {useRecord} from '../../../../ui/hooks/useRecord';
import {getCategoryById} from '../../../../data/services/categoryService';
import type {HomeStackParamList} from '../../../../navigation/types';

export const UpdateCategoryScreen = () => {
  const {categoryId} = useRoute<RouteProp<HomeStackParamList, 'UpdateCategoryScreen'>>().params;
  const state = useRecord(categoryId, getCategoryById);
  return <RecordGate state={state}>{category => <CategoryEntry editing={category} />}</RecordGate>;
};
