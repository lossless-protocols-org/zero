import {majorOf, PRO_MAJOR} from './appVersion';

interface WhatsNewFacts {
  /** The version this install first ran, or null before the database has opened. */
  firstSeenVersion: string | null;
  appVersion: string;
  /** Whether the screen has been shown on this install. */
  seen: boolean;
}

/**
 * Whether to show "What's new in 3.0" (owner decision 14: one dismissible
 * screen, once, on update). Only on an install that was here before 3.0 and
 * is now on 3.x: a new install has nothing that is new to it, and from 4.0 on
 * the news is old.
 */
export const shouldShowWhatsNew = ({firstSeenVersion, appVersion, seen}: WhatsNewFacts): boolean => {
  const firstMajor = majorOf(firstSeenVersion);
  return !seen && majorOf(appVersion) === PRO_MAJOR && firstMajor !== null && firstMajor < PRO_MAJOR;
};
