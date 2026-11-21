import React from 'react';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {CategoryEntry} from '../../components/CategoryEntry';
import type {HomeStackParamList} from '../../../../navigation/types';

export const AddCategoryScreen = () => {
  const kind = useRoute<RouteProp<HomeStackParamList, 'AddCategoryScreen'>>().params?.kind ?? 'expense';
  return <CategoryEntry kind={kind} />;
};
