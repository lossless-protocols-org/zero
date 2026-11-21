/**
 * What Pro adds to Reports, and where (UX revamp v2): Trends as a second tab,
 * "Share as PDF" in the header, a custom range as one more choice in the
 * month picker. Without Pro none of the three exists (law L8): the screen is
 * exactly the free one. Real LokiJS database.
 */
import React from 'react';
import {act, fireEvent, screen} from '@testing-library/react-native';
import {SheetManager} from 'react-native-actions-sheet';
import {ReportsScreen} from '../../../../../src/features/reports/screens/ReportsScreen';
import {navigate} from '../../../../../src/platform/navigationUtils';
import {setEntitlement} from '../../../../harness/mocks/entitlement';
import {seedAccounts} from '../../../../harness/accountsSeed';
import {renderInApp} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));
jest.mock('../../../../../src/pro/entitlementStore', () =>
  require('../../../../harness/mocks/entitlement').entitlementStoreMock(),
);
jest.mock('../../../../../src/platform/navigationUtils', () => ({goBack: jest.fn(), navigate: jest.fn()}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  ...require('../../../../harness/mocks/focusEffect'),
}));

beforeEach(async () => {
  await seedAccounts();
  jest.mocked(navigate).mockClear();
});
afterEach(() => {
  setEntitlement();
  jest.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const show = async () => {
  await renderInApp(<ReportsScreen />);
  await settle();
};
/** Opens the month picker and returns what Reports handed it. */
const pickerPayload = async (): Promise<{onCustomRange?: () => void}> => {
  const shown = jest.spyOn(SheetManager, 'show').mockResolvedValue(undefined);
  // The month's own name is the button's label ("November 2026").
  const [monthButton] = screen.getAllByLabelText(/^\D+ \d{4}$/);
  if (!monthButton) {
    throw new Error('no month button');
  }
  await fireEvent.press(monthButton);
  const call = shown.mock.calls.find(([id]) => id === 'month-year-picker-sheet');
  return (call?.[1] as {payload: {onCustomRange?: () => void}}).payload; // the picker's own payload
};

it('without Pro: no tabs, no share, no custom range', async () => {
  await show();
  expect(screen.queryByText('reports.tabTrends')).toBeNull();
  expect(screen.queryByLabelText('reports.sharePdf')).toBeNull();
  expect((await pickerPayload()).onCustomRange).toBeUndefined();
});

it('with Pro: Trends is a tab, share is in the header, and a custom range is offered with the months', async () => {
  setEntitlement({state: 'lifetime'});
  await show();
  await fireEvent.press(screen.getByText('reports.tabTrends'));
  expect(navigate).toHaveBeenLastCalledWith('TrendsScreen');
  expect(screen.getByLabelText('reports.sharePdf')).toBeTruthy();
  const payload = await pickerPayload();
  payload.onCustomRange?.();
  expect(navigate).toHaveBeenLastCalledWith('RangeReportScreen');
});
