import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import {fetchDebtors, selectDebtorData} from '../../redux/slice/debtorDataSlice';
import {fetchAllDebts, selectAllDebts} from '../../redux/slice/debtDataSlice';
import {useCallback, useMemo, useState} from 'react';
import {DebtorData as Debtor, DebtData as Debt} from '../../watermelondb/services';
import {useFocusEffect} from '@react-navigation/native';
import {isBorrowType} from '../../utils/debtType';

const useDebts = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const debtors = useAppSelector(selectDebtorData);
  const allDebts = useAppSelector(selectAllDebts);
  const [debtorType, setDebtorType] = useState('Person');

  const {personDebtors, otherAccountsDebtors} = useMemo(
    () => ({
      personDebtors: debtors.filter((debtor: Debtor) => debtor.type === 'Person'),
      otherAccountsDebtors: debtors.filter((debtor: Debtor) => debtor.type !== 'Person'),
    }),
    [debtors],
  );

  const totalDebts = useMemo(() => {
    let borrowings = 0;
    let lendings = 0;

    allDebts.forEach((debt: Debt) => {
      if (isBorrowType(debt.type)) {
        borrowings += debt.amount;
      } else {
        lendings += debt.amount;
      }
    });

    return borrowings - lendings;
  }, [allDebts]);

  useFocusEffect(
    useCallback(() => {
      void dispatch(fetchDebtors());
      void dispatch(fetchAllDebts());
    }, [dispatch]),
  );

  return {
    colors,
    allDebts,
    debtorType,
    setDebtorType,
    personDebtors,
    otherAccountsDebtors,
    totalDebts,
    debtors,
  };
};

export default useDebts;
