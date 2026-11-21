import {getAllUsers} from '../data/services/userService';
import {getUpcoming, materialiseDue} from '../data/services/recurringService';
import {todayIsoDay} from '../domain/dates';
import {isPro} from './entitlement';
import {getEntitlement} from './entitlementStore';
import {reconcile, registerProducer} from './reconcile';
import {planReminders, scheduleReminders, type ReminderText} from './reminders';
import {setRecurringState} from './recurringState';

/**
 * The producers of plan P9 (ZERO_3.0_ENTITLEMENT.md §5), each told the
 * entitlement on every cold start, return to the foreground and change (L4):
 *
 * - `recurringMaterialiser`: with Pro, makes each rule's due occurrence and
 *   notes what waits for the user; without it, makes nothing (rules keep
 *   their next run, and are asked about when Pro returns).
 * - `reminders`: with Pro, the reminders of what is coming are the ones
 *   pending; without it, none are.
 *
 * Both are safe to run any number of times with the same entitlement.
 */

/** How far ahead reminders are planned: the longest reminder (30 days) and a month of occurrences after it. */
const REMINDER_HORIZON_DAYS = 62;

/** The one user of this install, or null before onboarding. */
const userIdNow = async (): Promise<string | null> => (await getAllUsers())[0]?.id ?? null;

let started = false;

/** Registers the two producers, once per JS runtime. `text` words a reminder (the app has the language). */
export const startRecurringProducers = (text: ReminderText): void => {
  if (started) {
    return;
  }
  started = true;
  registerProducer({
    key: 'recurringMaterialiser',
    sync: async entitlement => {
      const userId = await userIdNow();
      if (!isPro(entitlement.state) || userId === null) {
        setRecurringState({behind: [], asks: []});
        return;
      }
      const {behind, asks} = await materialiseDue(userId, todayIsoDay());
      setRecurringState({behind, asks});
    },
  });
  registerProducer({
    key: 'reminders',
    sync: async entitlement => {
      const userId = await userIdNow();
      if (!isPro(entitlement.state) || userId === null) {
        await scheduleReminders([]);
        return;
      }
      const upcoming = await getUpcoming(userId, todayIsoDay(), REMINDER_HORIZON_DAYS);
      await scheduleReminders(planReminders(upcoming, Date.now(), text));
    },
  });
};

/**
 * Runs every producer again now, with the entitlement as it stands: after the
 * user changes a rule, so what is made and reminded follows at once.
 */
export const rerunProducers = (): Promise<void> => reconcile(getEntitlement());
