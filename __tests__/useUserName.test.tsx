/**
 * M11 (v2.7.1): the header and Settings each read the name and wrote it back
 * with their own copy of "update the row, then the store". One hook now owns
 * both, and a rename with no user row fails loudly instead of silently
 * returning (Settings) or writing to user ''.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';

const mockUpdateUserById = jest.fn((_id: string, _patch: {username: string}) => Promise.resolve());
const mockUser = {userId: 'u1', userName: 'Ada'};
jest.mock('../src/watermelondb/services', () => ({
  updateUserById: (id: string, patch: {username: string}) => mockUpdateUserById(id, patch),
  getAllUsers: () =>
    Promise.resolve(mockUser.userId ? [{id: mockUser.userId, username: mockUser.userName, email: ''}] : []),
}));

// required after jest.mock so the mocks apply; each cast names the module's own type
const store = (require('../src/redux/store') as typeof import('../src/redux/store')).default;
const {fetchUserData} = require('../src/redux/slice/userIdSlice') as typeof import('../src/redux/slice/userIdSlice');
const {useUserName} = require('../src/hooks/useUserName') as typeof import('../src/hooks/useUserName');

const mountHook = async () => {
  const latest: {current?: ReturnType<typeof useUserName>} = {};
  const Probe = () => {
    latest.current = useUserName();
    return null;
  };
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );
  });
  return latest;
};

beforeEach(() => mockUpdateUserById.mockClear());

describe('useUserName', () => {
  it('reads the loaded name and renames through the row, then the store', async () => {
    mockUser.userId = 'u1';
    await store.dispatch(fetchUserData());
    const hook = await mountHook();
    expect(hook.current?.userName).toBe('Ada');
    await ReactTestRenderer.act(async () => {
      await hook.current?.rename('Grace');
    });
    expect(mockUpdateUserById).toHaveBeenCalledWith('u1', {username: 'Grace'});
    expect(hook.current?.userName).toBe('Grace');
  });

  it('rejects a rename when no user row is loaded, writing nothing', async () => {
    mockUser.userId = '';
    await store.dispatch(fetchUserData());
    const hook = await mountHook();
    await expect(hook.current?.rename('Grace')).rejects.toThrow('user id is empty');
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });
});
