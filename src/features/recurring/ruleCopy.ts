import type {ParseKeys, TFunction} from 'i18next';
import type {Cadence, RuleStatus, RuleTarget} from '../../domain/recurrence';

export const TARGET_LABEL: Record<RuleTarget, ParseKeys> = {
  expense: 'recurring.targetExpense',
  income: 'recurring.targetIncome',
  transfer: 'recurring.targetTransfer',
};

export const CADENCE_LABEL: Record<Cadence, ParseKeys> = {
  monthly: 'recurring.cadenceMonthly',
  weekly: 'recurring.cadenceWeekly',
  yearly: 'recurring.cadenceYearly',
  everyNDays: 'recurring.cadenceEveryNDays',
};

/** "Every month", "Every 2 weeks", "Every 10 days". */
export const scheduleText = (cadence: Cadence, interval: number, t: TFunction): string => {
  switch (cadence) {
    case 'monthly':
      return t('recurring.monthly', {count: interval});
    case 'weekly':
      return t('recurring.weekly', {count: interval});
    case 'yearly':
      return t('recurring.yearly', {count: interval});
    case 'everyNDays':
      return t('recurring.everyNDays', {count: interval});
  }
};

/** What a rule's row says instead of its next day, when it is not running. */
export const STATUS_LABEL: Partial<Record<RuleStatus, ParseKeys>> = {
  paused: 'recurring.statusPaused',
  ended: 'recurring.statusEnded',
  needsCategory: 'recurring.statusNeedsCategory',
  needsAccount: 'recurring.statusNeedsAccount',
};

/** The reminder choices the form offers: none, the day itself, or this many days before. */
export const REMIND_CHOICES: ReadonlyArray<number | null> = [null, 0, 1, 2, 3, 7];
