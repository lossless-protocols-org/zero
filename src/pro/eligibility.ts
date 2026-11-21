import {majorOf, PRO_MAJOR} from './appVersion';
import type {OriginalInstall} from './schema';

/**
 * The first build number of 3.0 on the App Store (plan §4). A signed original build below it was here before Pro.
 * @internal Used by `isThanksEligible`; tests name the boundary.
 */
export const FIRST_3_0_BUILD = 40;

/**
 * When the thank-you price ends: one fixed date, 90 days after 3.0 launches
 * (owner decision 7 to 9). Null until the launch date is set, and while it is
 * null nobody is eligible: a release that forgets to set it shows no discount,
 * never a discount without an end. Set it in the release that ships 3.0.
 * @internal Used by `isThanksEligible`; a test pins that it is unset until launch.
 */
export const THANKS_ENDS_ON_MS: number | null = null;

interface ThanksFacts {
  /** The version this install first ran (src/platform/firstSeenVersion.ts), or null before the database has opened. */
  firstSeenVersion: string | null;
  /** What the store signed about the first download; unsigned where the store does not say. */
  originalInstall: OriginalInstall;
  nowMs: number;
  endsOnMs?: number | null;
}

/**
 * Whether this install gets the thank-you lifetime price: it was using zero
 * before 3.0, and the offer has not ended. Either record is enough: the
 * install's own first-seen version (kept across updates, lost on reinstall),
 * or the store's signed original build (survives a reinstall; App Store only).
 *
 * This only chooses which product the sheet shows. The price is the store's:
 * someone who edits the record is offered a product the store sells to anyone.
 */
export const isThanksEligible = ({
  firstSeenVersion,
  originalInstall,
  nowMs,
  endsOnMs = THANKS_ENDS_ON_MS,
}: ThanksFacts): boolean => {
  if (endsOnMs === null || nowMs >= endsOnMs) {
    return false;
  }
  const firstMajor = majorOf(firstSeenVersion);
  const seenBeforePro = firstMajor !== null && firstMajor < PRO_MAJOR;
  const downloadedBeforePro =
    originalInstall.signed && originalInstall.build !== null && originalInstall.build < FIRST_3_0_BUILD;
  return seenBeforePro || downloadedBeforePro;
};
