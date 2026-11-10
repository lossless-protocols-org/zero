/**
 * M1 (v2.7.1): every data thunk ended in `rejectWithValue`, which resolves
 * the dispatch promise, and nothing outside the slices read the `error`
 * fields it wrote — so a locked or corrupt database showed Home as "no
 * transactions" with no record anywhere. One store middleware now writes
 * every rejection to the error log and to a `dataError` slice; the app shows
 * one dialog per session and a banner on the affected screen.
 * LokiJS harness as in importService.test.ts; real store for the thunks.
 */
import React from 'react';
import {act, render, screen} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import '../../src/i18n'; // as App.tsx does first: the banner copy is asserted below
import {database} from '../../src/data/database/database';
import {store} from '../../src/store/store';
import {fetchEverydayExpenses, fetchExpensesByMonth} from '../../src/store/slices/expenseDataSlice';
import {fetchUserData} from '../../src/store/slices/userIdSlice';
import {selectDataError} from '../../src/store/slices/dataErrorSlice';
import * as expenseService from '../../src/data/services/expenseService';
import * as errorLog from '../../src/platform/errorLog';
import {createUser} from '../harness/services';
import {DataErrorBanner} from '../../src/ui/atoms/DataErrorBanner';
import {DataErrorDialog} from '../../src/ui/atoms/DataErrorDialog';
import {ThemeProvider} from '../../src/ui/context/ThemeContext';

const mockShowAlert = jest.fn(async () => undefined);
jest.mock('../../src/ui/context/DialogContext', () => ({
  useDialog: () => ({showAlert: mockShowAlert, showDialog: jest.fn(async () => true)}),
}));

const flush = () => act(() => new Promise<void>(resolve => setTimeout(() => resolve(), 0)));

const texts = (): string[] =>
  screen.container.queryAll(node => node.type === 'Text').map(node => node.children.join(''));

const showInStore = (ui: React.ReactElement) =>
  render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>,
  );

describe('thunk rejections are observable', () => {
  let logSpy: jest.SpyInstance;
  beforeAll(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    await createUser('Ada', '');
    await store.dispatch(fetchUserData());
  });
  beforeEach(() => {
    logSpy = jest.spyOn(errorLog, 'appendErrorLog').mockImplementation(() => undefined);
    mockShowAlert.mockClear();
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('a failing month fetch writes ONE error-log entry naming the thunk and records the domain error', async () => {
    jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('database is locked'));
    const action = await store.dispatch(fetchExpensesByMonth('2026-10'));
    expect(fetchExpensesByMonth.rejected.match(action)).toBe(true);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('expense/fetchByMonth');
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('database is locked');
    expect(selectDataError(store.getState(), ['expense'])).toBe('database is locked');
  });

  it('shows the banner on the affected screen and ONE dialog per session, even for a second rejection', async () => {
    await showInStore(
      <>
        <DataErrorDialog />
        <DataErrorBanner domains={['expense']} />
      </>,
    );
    await flush();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(texts().some(t => /couldn.t be loaded|could not be loaded/i.test(t))).toBe(true);

    jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk I/O error'));
    await act(() => store.dispatch(fetchExpensesByMonth('2026-09')));
    await flush();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('a success of a DIFFERENT thunk in the same domain does not clear the failure', async () => {
    jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('database is locked'));
    await store.dispatch(fetchExpensesByMonth('2026-07'));
    await store.dispatch(fetchEverydayExpenses('2026-07-01'));
    expect(selectDataError(store.getState(), ['expense'])).toBe('database is locked');
  });

  it('a later success of the same thunk clears the error and the banner', async () => {
    await showInStore(<DataErrorBanner domains={['expense']} />);
    await act(() => store.dispatch(fetchExpensesByMonth('2026-08')));
    await flush();
    expect(selectDataError(store.getState(), ['expense'])).toBeNull();
    expect(texts()).toEqual([]);
  });
});
