import {useCallback, useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../../../store/hooks';
import {useThemeColors} from '../../../../ui/hooks/useThemeColors';
import {fetchDebtors, selectDebtorData} from '../../../../store/slices/debtorDataSlice';
import {fetchAllDebts, selectAllDebts} from '../../../../store/slices/debtDataSlice';
import {useFreshWhileFocused} from '../../../../ui/hooks/useFreshWhileFocused';
import {debtorGroupOf, netDebt, netDebtByDebtor} from '../../../../domain/debtType';
import {fromMoneyUnits, toMoneyUnits} from '../../../../domain/money';

/** One person or tally as the Debts tab lists it. `net` above zero: you owe them. */
export interface DebtorRow {
  id: string;
  title: string;
  icon: string;
  color: string;
  net: number;
}

const sumOf = (rows: readonly DebtorRow[]): number =>
  fromMoneyUnits(rows.reduce((units, row) => units + toMoneyUnits(row.net), 0));

/**
 * The Debts tab's people and tallies (the free app's debts): every debtor
 * with what stands between you, split into people and the simple card and
 * loan tallies, and what each group and all of them net to. Read on focus
 * and after writes while focused.
 */
export const useDebts = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const debtors = useAppSelector(selectDebtorData);
  const allDebts = useAppSelector(selectAllDebts);
  const {people, tallies} = useMemo(() => {
    // Exact per person (netDebtByDebtor): a float sum read a settled person as "You owe".
    const nets = netDebtByDebtor(allDebts);
    const rows = debtors.map(debtor => {
      const id = String(debtor.id);
      const row: DebtorRow = {
        id,
        title: debtor.title,
        icon: debtor.icon,
        color: debtor.color,
        net: nets.get(id) ?? 0,
      };
      return {row, group: debtorGroupOf(debtor.type)};
    });
    return {
      people: rows.filter(item => item.group === 'people').map(item => item.row),
      tallies: rows.filter(item => item.group === 'accounts').map(item => item.row),
    };
  }, [debtors, allDebts]);
  const totalDebts = useMemo(() => netDebt(allDebts), [allDebts]);

  useFreshWhileFocused(
    useCallback(() => {
      void dispatch(fetchDebtors());
      void dispatch(fetchAllDebts());
    }, [dispatch]),
    ['debts', 'debtors'],
  );

  return {
    colors,
    people,
    tallies,
    peopleNet: sumOf(people),
    talliesNet: sumOf(tallies),
    totalDebts,
    empty: debtors.length === 0,
  };
};
