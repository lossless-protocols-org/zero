/**
 * The user's name (M11, M32 review; v2.7.1): one hook reads it and renames
 * through the row, then the store. Real store, real services, the LokiJS
 * database: nothing of ours is mocked, only the copy (keys, plus the
 * placeholder's translation).
 *
 * The stored placeholder 'User' is shown in the app language. The rename
 * sheet opens with that shown text, so tapping Update unchanged used to write
 * the TRANSLATED word into the database, where it no longer follows the
 * language; saving it back unchanged now keeps the stored one.
 */
import React from 'react';
import {act, renderHook} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {store} from '../../../../src/store/store';
import {resetSession} from '../../../../src/store/rootReducer';
import {fetchUserData} from '../../../../src/store/slices/userIdSlice';
import {useUserName} from '../../../../src/ui/hooks/useUserName';
import * as services from '../../../harness/services';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));

const wrapper = ({children}: {children: React.ReactNode}) => <Provider store={store}>{children}</Provider>;

/** A session for a user called `name` (none when null), and the hook in it. */
const start = async (name: string | null) => {
  await services.deleteAllData();
  store.dispatch(resetSession());
  if (name !== null) {
    await services.createUser(name, '');
  }
  await store.dispatch(fetchUserData());
  return (await renderHook(() => useUserName(), {wrapper})).result;
};

const storedNames = async () => (await services.getAllUsers()).map(u => u.username);

beforeAll(() => setMockTranslations({'common.defaultUserName': 'Usuario'}));

it('shows the stored name, and the placeholder in the app language', async () => {
  expect((await start('Ada')).current.userName).toBe('Ada');
  expect((await start('User')).current.userName).toBe('Usuario');
});

it('renames through the row, then the store', async () => {
  const hook = await start('Ada');
  await act(() => hook.current.rename('Grace'));
  expect(await storedNames()).toEqual(['Grace']);
  expect(hook.current.userName).toBe('Grace');
});

it('keeps the stored placeholder when its translation is saved back unchanged', async () => {
  const hook = await start('User');
  await act(() => hook.current.rename('Usuario'));
  await act(() => hook.current.rename('  Usuario '));
  expect(await storedNames()).toEqual(['User']);
  expect(hook.current.userName).toBe('Usuario');
});

it('saves a name that happens to equal the translation when the stored name was not the placeholder', async () => {
  const hook = await start('Ravi');
  await act(() => hook.current.rename('Usuario'));
  expect(await storedNames()).toEqual(['Usuario']);
});

it('rejects a rename when no user row is loaded, writing nothing', async () => {
  const hook = await start(null);
  await expect(hook.current.rename('Grace')).rejects.toThrow('user id is empty');
  expect(await storedNames()).toEqual([]);
});
