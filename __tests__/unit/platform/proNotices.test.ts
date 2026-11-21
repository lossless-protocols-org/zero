/** What this install has already been told about Pro, each kept so it is said once. */
import {proEndedNoticePreference, whatsNewSeenPreference} from '../../../src/platform/proNotices';
import {StorageService} from '../../../src/platform/storage';

it('nothing has been said on a new install', () => {
  expect(whatsNewSeenPreference.get()).toBe(false);
  expect(proEndedNoticePreference.get()).toBe(0);
});

it('remembers both under their own keys', () => {
  whatsNewSeenPreference.set(true);
  proEndedNoticePreference.set(1_800_000_000_000);
  expect(StorageService.getBoolean('whats_new_3_0_seen')).toBe(true);
  expect(StorageService.getItemSync('pro_ended_notice_for')).toBe('1800000000000');
  whatsNewSeenPreference.invalidate();
  proEndedNoticePreference.invalidate();
  expect(whatsNewSeenPreference.get()).toBe(true);
  expect(proEndedNoticePreference.get()).toBe(1_800_000_000_000);
});
