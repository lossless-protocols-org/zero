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
import ReactTestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import type {Database} from '@nozbe/watermelondb';
import '../src/i18n'; // as App.tsx does first: the banner copy is asserted below

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('thunkRejectionTest'),
);

const mockShowAlert = jest.fn(async () => undefined);
jest.mock('../src/context/DialogContext', () => ({
  useDialog: () => ({showAlert: mockShowAlert, showDialog: jest.fn(async () => true)}),
}));

// required after jest.mock so the mock applies; each cast names the module's own type
const {database} = require('../src/watermelondb/database') as {database: Database};
const store = (require('../src/redux/store') as typeof import('../src/redux/store')).default;
const {fetchExpensesByMonth} =
  require('../src/redux/slice/expenseDataSlice') as typeof import('../src/redux/slice/expenseDataSlice');
const {fetchUserData} = require('../src/redux/slice/userIdSlice') as typeof import('../src/redux/slice/userIdSlice');
const {selectDataError} =
  require('../src/redux/slice/dataErrorSlice') as typeof import('../src/redux/slice/dataErrorSlice');
const expenseService =
  require('../src/watermelondb/services/expenseService') as typeof import('../src/watermelondb/services/expenseService');
const errorLog = require('../src/utils/errorLog') as typeof import('../src/utils/errorLog');
const {createUser} = require('../src/watermelondb/services') as typeof import('../src/watermelondb/services');
const {DataErrorBanner} =
  require('../src/components/atoms/DataErrorBanner') as typeof import('../src/components/atoms/DataErrorBanner');
const {DataErrorDialog} =
  require('../src/components/atoms/DataErrorDialog') as typeof import('../src/components/atoms/DataErrorDialog');
const {ThemeProvider} = require('../src/context/ThemeContext') as typeof import('../src/context/ThemeContext');

const flush = async (): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  });
};

const texts = (renderer: ReactTestRenderer.ReactTestRenderer): string[] =>
  renderer.root
    .findAll(node => typeof node.type === 'string' && String(node.type) === 'Text')
    .flatMap(node => {
      const children: unknown = node.props['children'];
      return typeof children === 'string' ? [children] : [];
    });

describe('thunk rejections are observable (M1)', () => {
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
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <Provider store={store}>
          <ThemeProvider>
            <DataErrorDialog />
            <DataErrorBanner domains={['expense']} />
          </ThemeProvider>
        </Provider>,
      );
    });
    await flush();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    const shown = texts(renderer!); // created in act above
    expect(shown.some(t => /couldn.t be loaded|could not be loaded/i.test(t))).toBe(true);

    jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('disk I/O error'));
    await ReactTestRenderer.act(async () => {
      await store.dispatch(fetchExpensesByMonth('2026-09'));
    });
    await flush();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('a success of a DIFFERENT thunk in the same domain does not clear the failure', async () => {
    const {fetchEverydayExpenses} =
      require('../src/redux/slice/expenseDataSlice') as typeof import('../src/redux/slice/expenseDataSlice');
    jest.spyOn(expenseService, 'getAllExpensesByMonth').mockRejectedValueOnce(new Error('database is locked'));
    await store.dispatch(fetchExpensesByMonth('2026-07'));
    await store.dispatch(fetchEverydayExpenses('2026-07-01'));
    expect(selectDataError(store.getState(), ['expense'])).toBe('database is locked');
  });

  it('a later success of the same thunk clears the error and the banner', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <Provider store={store}>
          <ThemeProvider>
            <DataErrorBanner domains={['expense']} />
          </ThemeProvider>
        </Provider>,
      );
    });
    await ReactTestRenderer.act(async () => {
      await store.dispatch(fetchExpensesByMonth('2026-08'));
    });
    await flush();
    expect(selectDataError(store.getState(), ['expense'])).toBeNull();
    expect(texts(renderer!)).toEqual([]); // created in act above
  });
});
