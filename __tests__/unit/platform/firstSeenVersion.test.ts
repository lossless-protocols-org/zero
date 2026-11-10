/**
 * Plan §5.6 (2.8): 3.0 decides the ₹299 offer from this value, so it is
 * written once, from the running version, and never overwritten.
 */
import {StorageService} from '../../../src/platform/storage';
import {recordFirstSeenVersion} from '../../../src/platform/firstSeenVersion';
import {getAppVersion} from '../../../src/platform/getVersion';

describe('recordFirstSeenVersion', () => {
  beforeEach(() => {
    StorageService.removeItemSync('firstSeenAppVersion');
  });

  it('records the running version on first launch', () => {
    expect(recordFirstSeenVersion()).toBe(getAppVersion());
    expect(StorageService.getItemSync('firstSeenAppVersion')).toBe(getAppVersion());
  });

  it('never overwrites an earlier version (an update keeps the first one)', () => {
    StorageService.setItemSync('firstSeenAppVersion', '2.8.0');
    expect(recordFirstSeenVersion()).toBe('2.8.0');
    expect(StorageService.getItemSync('firstSeenAppVersion')).toBe('2.8.0');
  });
});
