/** How a rule's schedule reads, and what a row says when it is not running. */
import {REMIND_CHOICES, STATUS_LABEL, scheduleText} from '../../../../src/features/recurring/ruleCopy';

const t = ((key: string, options?: {count?: number}) => `${key}:${options?.count ?? ''}`) as Parameters<
  typeof scheduleText
>[2]; // a stand-in TFunction that shows key and count

it('says each cadence with its count', () => {
  expect(scheduleText('monthly', 1, t)).toBe('recurring.monthly:1');
  expect(scheduleText('weekly', 2, t)).toBe('recurring.weekly:2');
  expect(scheduleText('yearly', 1, t)).toBe('recurring.yearly:1');
  expect(scheduleText('everyNDays', 10, t)).toBe('recurring.everyNDays:10');
});

it('a running rule shows its next day; the others say why not', () => {
  expect(STATUS_LABEL.active).toBeUndefined();
  expect(STATUS_LABEL.needsCategory).toBe('recurring.statusNeedsCategory');
  expect(REMIND_CHOICES[0]).toBeNull();
});
