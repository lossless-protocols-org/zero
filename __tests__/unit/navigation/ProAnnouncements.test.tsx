/**
 * The two things zero says about Pro without being asked, each once (3.0):
 * "What's new in 3.0" to an install that updated, never to a new one; and
 * "zero Pro has ended", once per ending.
 */
import React from 'react';
import {act, render} from '@testing-library/react-native';
import {Linking} from 'react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {ProAnnouncements} from '../../../src/navigation/ProAnnouncements';
import * as firstSeen from '../../../src/platform/firstSeenVersion';
import * as version from '../../../src/platform/getVersion';
import * as navigationUtils from '../../../src/platform/navigationUtils';
import {proEndedNoticePreference, whatsNewSeenPreference} from '../../../src/platform/proNotices';
import {setProScreenOpen} from '../../../src/pro/proGate';
import {resetEntitlement, setEntitlement} from '../../harness/mocks/entitlement';
import {answerNextDialog, dialogsSaid, resetDialogs} from '../../harness/mocks/dialogs';
import {setRecurringState} from '../../../src/pro/recurringState';

jest.mock('../../../src/pro/entitlementStore', () => require('../../harness/mocks/entitlement').entitlementStoreMock());
jest.mock('../../../src/ui/context/DialogContext', () => require('../../harness/mocks/dialogs').dialogContextMock());
jest.mock('react-i18next', () => require('../../harness/mocks/reactI18next'));
// The screen is opened once the first frame has drawn; here that is at once.
jest.mock('../../../src/platform/afterInteractions', () => ({
  afterInteractions: (work: () => void) => {
    work();
    return {cancel: () => undefined};
  },
}));

let navigate: jest.SpyInstance;
let show: jest.SpyInstance;

const install = (firstSeenVersion: string | null, appVersion: string) => {
  jest.spyOn(firstSeen, 'getFirstSeenVersion').mockReturnValue(firstSeenVersion);
  jest.spyOn(version, 'getAppVersion').mockReturnValue(appVersion);
};

beforeEach(() => {
  navigate = jest.spyOn(navigationUtils, 'navigate').mockImplementation(() => undefined);
  show = jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  whatsNewSeenPreference.set(false);
  proEndedNoticePreference.set(0);
  install('3.0.0', '3.0.0');
});
afterEach(async () => {
  await act(async () => {
    setProScreenOpen(false);
    resetEntitlement();
  });
  jest.restoreAllMocks();
});

describe("what's new in 3.0", () => {
  it('opens once for an install that updated from before 3.0', async () => {
    install('2.8.0', '3.0.0');
    const first = await render(<ProAnnouncements />);
    await act(async () => {});
    expect(navigate.mock.calls).toEqual([['WhatsNewScreen']]);
    expect(whatsNewSeenPreference.get()).toBe(true);
    // The next launch, and every one after it.
    await first.unmount();
    await render(<ProAnnouncements />);
    await act(async () => {});
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('waits for a plain launch when a link opened the app, and is still due then', async () => {
    install('2.8.0', '3.0.0');
    jest.mocked(Linking.getInitialURL).mockResolvedValue('zero://quick?kind=expense');
    const linked = await render(<ProAnnouncements />);
    await act(async () => {});
    expect(navigate).not.toHaveBeenCalled();
    expect(whatsNewSeenPreference.get()).toBe(false);
    await linked.unmount();
    jest.mocked(Linking.getInitialURL).mockResolvedValue(null);
    await render(<ProAnnouncements />);
    await act(async () => {});
    expect(navigate.mock.calls).toEqual([['WhatsNewScreen']]);
  });

  it('is shown when the system cannot say how the app was opened', async () => {
    install('2.8.0', '3.0.0');
    jest.mocked(Linking.getInitialURL).mockRejectedValue(new Error('no answer'));
    await render(<ProAnnouncements />);
    await act(async () => {});
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('never opens for a new install', async () => {
    install('3.0.0', '3.0.0');
    await render(<ProAnnouncements />);
    expect(navigate).not.toHaveBeenCalled();
    expect(whatsNewSeenPreference.get()).toBe(false);
  });

  it('does not open before 3.0', async () => {
    install('2.7.1', '2.8.0');
    await render(<ProAnnouncements />);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('zero Pro has ended', () => {
  const ended = (endedAtMs: number) => ({state: 'expired' as const, productId: 'zero_pro', endedAtMs});

  it('is not shown to someone who never had Pro, or who has it', async () => {
    await render(<ProAnnouncements />);
    await act(async () => setEntitlement({state: 'lifetime'}));
    await act(async () => setEntitlement({state: 'pending'}));
    expect(show).not.toHaveBeenCalled();
  });

  it('is shown when Pro ends, and recorded against that ending', async () => {
    await act(async () => setEntitlement({state: 'subscribed'}));
    await render(<ProAnnouncements />);
    await act(async () => setEntitlement(ended(1000)));
    expect(show.mock.calls).toEqual([['pro-ended-sheet']]);
    expect(proEndedNoticePreference.get()).toBe(1000);
  });

  it('is shown once per ending: not again on the next launch, nor when the payment flaps within it', async () => {
    await act(async () => setEntitlement(ended(1000)));
    const first = await render(<ProAnnouncements />);
    expect(show).toHaveBeenCalledTimes(1);
    await first.unmount();
    await render(<ProAnnouncements />);
    await act(async () => setEntitlement({...ended(1000), state: 'onHold'}));
    await act(async () => setEntitlement(ended(1000)));
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('is shown again for a later ending', async () => {
    await act(async () => setEntitlement(ended(1000)));
    await render(<ProAnnouncements />);
    await act(async () => setEntitlement({state: 'subscribed'}));
    await act(async () => setEntitlement(ended(2000)));
    expect(show).toHaveBeenCalledTimes(2);
    expect(proEndedNoticePreference.get()).toBe(2000);
  });

  it('waits while a Pro screen is open, and is shown when the user leaves it', async () => {
    await act(async () => setEntitlement({state: 'subscribed'}));
    await render(<ProAnnouncements />);
    await act(async () => setProScreenOpen(true));
    await act(async () => setEntitlement(ended(1000)));
    expect(show).not.toHaveBeenCalled();
    await act(async () => setProScreenOpen(false));
    expect(show.mock.calls).toEqual([['pro-ended-sheet']]);
  });
});

describe('missed recurring entries (P9)', () => {
  it('with Pro, says so once and offers to show them; adding or skipping is not done here', async () => {
    resetDialogs();
    await act(async () => setEntitlement({state: 'lifetime'}));
    answerNextDialog(true);
    await act(async () => setRecurringState({behind: [{ruleId: 'r', title: 'Rent', missed: 3}], asks: []}));
    const view = await render(<ProAnnouncements />);
    await act(() => Promise.resolve());
    expect(dialogsSaid()).toEqual(['info: recurring.missedPrompt']);
    expect(navigate).toHaveBeenCalledWith('RecurringScreen');
    // Again in the same run: not asked twice.
    await view.rerender(<ProAnnouncements />);
    await act(async () => setRecurringState({behind: [{ruleId: 'r', title: 'Rent', missed: 3}], asks: []}));
    expect(dialogsSaid()).toHaveLength(1);
    await view.unmount();
    await act(async () => setRecurringState({behind: [], asks: []}));
    await act(async () => resetEntitlement());
  });
});
