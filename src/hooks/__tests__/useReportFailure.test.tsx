/**
 * M12 (v2.7.1): seven screens each had their own "log it, then tell the user
 * it was not saved" callback. One hook now does both.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockShowAlert = jest.fn((_opts: {type: string; message: string}) => Promise.resolve());
jest.mock('../../context/DialogContext', () => ({useDialog: () => ({showAlert: mockShowAlert})}));
jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => `t:${key}`})}));
const mockGoBack = jest.fn();
jest.mock('../../utils/navigationUtils', () => ({goBack: () => mockGoBack()}));

// required after jest.mock so the mocks apply; each cast names the module's own type
const {useReportFailure, useReportSaveFailure} = require('../useReportFailure') as typeof import('../useReportFailure');
const {clearErrorLog, getErrorLog} = require('../../utils/errorLog') as typeof import('../../utils/errorLog');

it('logs the error and shows the given save-failed message', async () => {
  clearErrorLog();
  let report: ((error: unknown) => Promise<void>) | undefined;
  const Probe = () => {
    report = useReportFailure('debt.saveFailed');
    return null;
  };
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  await report?.(new Error('constraint failed'));
  expect(getErrorLog().map(e => e.message)).toEqual(['constraint failed']);
  expect(mockShowAlert).toHaveBeenCalledWith({type: 'error', message: 't:debt.saveFailed'});
});

it('a save of a row deleted meanwhile says so and leaves the form (M19)', async () => {
  clearErrorLog();
  mockShowAlert.mockClear();
  let report: ((error: unknown) => Promise<void>) | undefined;
  const Probe = () => {
    report = useReportSaveFailure('debt.saveFailed');
    return null;
  };
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  await report?.(new Error('Record debts#abc123 not found'));
  expect(mockShowAlert).toHaveBeenCalledWith({type: 'error', message: 't:common.recordMissing'});
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  await report?.(new Error('disk I/O error'));
  expect(mockShowAlert).toHaveBeenLastCalledWith({type: 'error', message: 't:debt.saveFailed'});
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});
