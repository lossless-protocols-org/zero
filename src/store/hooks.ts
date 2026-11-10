import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from './store';
import type {RootState} from './rootReducer';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
