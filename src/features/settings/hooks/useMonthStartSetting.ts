import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager} from 'react-native-actions-sheet';
import {useAppSelector} from '../../../store/hooks';
import {selectUserId} from '../../../store/slices/userIdSlice';
import {setMonthStartDay} from '../../../data/services/userService';
import {DEFAULT_MONTH_START_DAY} from '../../../domain/period';
import {useMonthStartDay} from '../../../ui/hooks/useMonthStartDay';
import {useReportFailure} from '../../../ui/hooks/useReportFailure';
import {logRejection} from '../../../platform/errorLog';

/**
 * Settings → "Month starts on" (3.0 Pro, plan P11). Saving writes the user
 * row and nothing else: the session follows that row (store/followSession),
 * tells the one read point of every month (src/pro/monthStart.ts), and every
 * screen that shows a month reads it again. The row itself is drawn only
 * with Pro (`<ProSlot feature="monthStart">`).
 */
export const useMonthStartSetting = () => {
  const {t} = useTranslation();
  const userId = useAppSelector(selectUserId);
  const day = useMonthStartDay();
  const reportSaveFailure = useReportFailure('settings.saveFailed');

  const save = useCallback(
    async (next: number) => {
      if (!userId || next === day) {
        return;
      }
      try {
        await setMonthStartDay(userId, next);
      } catch (error) {
        await reportSaveFailure(error);
      }
    },
    [userId, day, reportSaveFailure],
  );

  const open = useCallback(() => {
    void SheetManager.show('month-start-picker-sheet', {
      payload: {current: day, onSelect: (next: number) => logRejection(save(next))},
    });
  }, [day, save]);

  return {
    day,
    label: day === DEFAULT_MONTH_START_DAY ? t('settings.monthStartFirst') : t('settings.monthStartDay', {day}),
    open,
  };
};
