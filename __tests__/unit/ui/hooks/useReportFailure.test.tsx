/**
 * M12 (v2.7.1): seven screens each had their own "log it, then tell the user
 * it was not saved" callback. One hook now does both.
 *
 * Tickets: M19.
 */
import {renderHook} from '@testing-library/react-native';
import {useReportFailure, useReportSaveFailure} from '../../../../src/ui/hooks/useReportFailure';
import {clearErrorLog, getErrorLog} from '../../../../src/platform/errorLog';

const mockShowAlert = jest.fn((_opts: {type: string; message: string}) => Promise.resolve());
jest.mock('../../../../src/ui/context/DialogContext', () => ({useDialog: () => ({showAlert: mockShowAlert})}));
jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
const mockGoBack = jest.fn();
jest.mock('../../../../src/platform/navigationUtils', () => ({goBack: () => mockGoBack()}));

it('logs the error and shows the given save-failed message', async () => {
  clearErrorLog();
  const {result} = await renderHook(() => useReportFailure('debt.saveFailed'));
  await result.current(new Error('constraint failed'));
  expect(getErrorLog().map(e => e.message)).toEqual(['constraint failed']);
  expect(mockShowAlert).toHaveBeenCalledWith({type: 'error', message: 'debt.saveFailed'});
});

it('a save of a row deleted meanwhile says so and leaves the form', async () => {
  clearErrorLog();
  mockShowAlert.mockClear();
  const {result} = await renderHook(() => useReportSaveFailure('debt.saveFailed'));
  await result.current(new Error('Record debts#abc123 not found'));
  expect(mockShowAlert).toHaveBeenCalledWith({type: 'error', message: 'common.recordMissing'});
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  await result.current(new Error('disk I/O error'));
  expect(mockShowAlert).toHaveBeenLastCalledWith({type: 'error', message: 'debt.saveFailed'});
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});
