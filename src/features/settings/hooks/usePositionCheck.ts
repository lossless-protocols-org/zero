import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {articulate, getAccountBalance, getNetWorth} from '../../../data/services/netWorthService';
import {formatDate} from '../../../domain/dates';
import {formatMonthLabel} from '../../../platform/dateFormat';
import {appendErrorLog} from '../../../platform/errorLog';
import {useFormatAmount} from '../../../ui/hooks/useFormatAmount';
import {useProFeature} from '../../../ui/hooks/useProFeature';
import {currentPeriodFor, getMonthStartDay, monthKeyNow} from '../../../pro/monthStart';
import {getTrends} from '../../../data/services/trendsService';
import {trendMonths} from '../../../domain/trends';

const now = (): number => performance.now();

/**
 * R16 on the device (ZERO_SYSTEM_DESIGN.md §2.1): whether this month's change
 * in net worth equals what explains it, and how long the balances take to
 * work out (the P8 exit gate is 20 ms per account on the Moto), and how long
 * Trends' twelve months take to read (the P12 gate: 50 ms). Read once,
 * when Diagnostics opens. With Pro only: without it there is no account
 * surface anywhere (ZERO_3.0_ENTITLEMENT.md §4), Diagnostics included.
 */
export const usePositionCheck = (): string[] => {
  const {t} = useTranslation();
  const formatAmount = useFormatAmount();
  const userId = useAppSelector(selectUserId);
  const pro = useProFeature('netWorth');
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || !pro) {
      setLines([]);
      return;
    }
    let live = true;
    const today = formatDate(undefined);
    const period = currentPeriodFor(monthKeyNow());
    const month = formatMonthLabel(period);
    (async () => {
      const startedAll = now();
      const worth = await getNetWorth(userId, today);
      const allMs = Math.round(now() - startedAll);
      let slowest = 0;
      // One at a time, so each is timed on its own.
      for (const account of worth.accounts) {
        const started = now();
        await getAccountBalance(userId, account.accountId, today);
        slowest = Math.max(slowest, now() - started);
      }
      const check = await articulate(userId, period.start, today);
      const gap = Math.abs(
        check.netWorthChange -
          (check.kept + check.revaluations + check.adjustments + check.openings + check.debtsOutsideAccounts),
      );
      // P12 gate: twelve of the user's months read for Trends, 50 ms on the low-end phone. The
      // median of five reads: the first also pays for the statement being prepared.
      const months = trendMonths(monthKeyNow(), 12, getMonthStartDay());
      const timings: number[] = [];
      for (let run = 0; run < 5; run++) {
        const started = now();
        await getTrends(userId, months);
        timings.push(now() - started);
      }
      const trendsMs = Math.round([...timings].sort((a, b) => a - b)[2] ?? 0);
      return [
        check.holds
          ? t('diagnostics.netWorthCheck', {month})
          : t('diagnostics.netWorthCheckOff', {month, amount: formatAmount(gap)}),
        t('diagnostics.balanceTiming', {ms: allMs, accounts: worth.accounts.length}),
        t('diagnostics.balanceSlowest', {ms: Math.round(slowest)}),
        t('diagnostics.trendsTiming', {ms: trendsMs}),
      ];
    })()
      .then(next => {
        if (live) {
          setLines(next);
        }
      })
      .catch((error: unknown) => appendErrorLog(error, false));
    return () => {
      live = false;
    };
  }, [userId, pro, t, formatAmount]);

  return lines;
};
