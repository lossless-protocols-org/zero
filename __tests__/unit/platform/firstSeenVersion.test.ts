/**
 * Plan §5.6 (2.8): 3.0 decides the thank-you price from this value, so it is
 * written once and never overwritten: the running version for a new install,
 * a pre-2.8 version for an install that already had data and no value.
 */
import {StorageService} from '../../../src/platform/storage';
import {getFirstSeenVersion, recordFirstSeenVersion} from '../../../src/platform/firstSeenVersion';
import {getAppVersion} from '../../../src/platform/getVersion';

describe('recordFirstSeenVersion', () => {
  beforeEach(() => {
    StorageService.removeItemSync('firstSeenAppVersion');
  });

  it('records the running version on the first launch of a new install', () => {
    expect(getFirstSeenVersion()).toBeNull();
    expect(recordFirstSeenVersion(false)).toBe(getAppVersion());
    expect(getFirstSeenVersion()).toBe(getAppVersion());
    expect(StorageService.getItemSync('firstSeenAppVersion')).toBe(getAppVersion());
  });

  it('never overwrites an earlier version (an update keeps the first one)', () => {
    StorageService.setItemSync('firstSeenAppVersion', '2.8.0');
    expect(recordFirstSeenVersion(false)).toBe('2.8.0');
    expect(recordFirstSeenVersion(true)).toBe('2.8.0');
    expect(StorageService.getItemSync('firstSeenAppVersion')).toBe('2.8.0');
  });

  it('records a version from before the flag existed for an install that already holds data and has none', () => {
    // 2.7.1 or older, updated straight past 2.8: years of use must not read as a new install.
    expect(recordFirstSeenVersion(true)).toBe('2.7.1');
    expect(StorageService.getItemSync('firstSeenAppVersion')).toBe('2.7.1');
    // And it stays, whatever later launches find.
    expect(recordFirstSeenVersion(false)).toBe('2.7.1');
  });
});
