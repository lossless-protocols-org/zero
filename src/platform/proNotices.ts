import {booleanValue, createMmkvPreference, wholeNumber} from './mmkvPreference';

/** Whether "What's new in 3.0" has been shown on this install (owner decision 14: once). */
export const whatsNewSeenPreference = createMmkvPreference<boolean>('whats_new_3_0_seen', booleanValue, false);

/**
 * The ending the "zero Pro has ended" notice was last shown for: the moment
 * Pro ended (`Entitlement.endedAtMs`), or 0 when it has never been shown. One
 * notice per ending, so a payment that flaps does not repeat it.
 */
export const proEndedNoticePreference = createMmkvPreference<number>('pro_ended_notice_for', wholeNumber, 0);

/**
 * Whether zero has asked to show reminders (P9). Asked once, when the first
 * rule with a reminder is saved: Android cannot tell "never asked" from "said
 * no", and asking again on every save would nag (and Android stops showing
 * the dialog after two refusals anyway).
 */
export const remindersAskedPreference = createMmkvPreference<boolean>(
  'reminders_permission_asked',
  booleanValue,
  false,
);
