/**
 * M32 review (v2.7.1): the stored placeholder name 'User' is shown in the app
 * language. The rename sheet opens with that shown text, so tapping Update
 * unchanged used to write the TRANSLATED word into the database, where it no
 * longer follows the language. Saving it back unchanged keeps the stored one.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockState = {userName: 'User' as string | null, userId: 'u1'};
const mockDispatch = jest.fn();
const mockUpdate = jest.fn((_id: string, _fields: {username: string}) => Promise.resolve());
jest.mock('../../redux/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (select: (s: unknown) => unknown) => select(undefined),
}));
jest.mock('../../redux/slice/userIdSlice', () => ({selectUserId: () => mockState.userId}));
jest.mock('../../redux/slice/userNameSlice', () => ({
  selectUserName: () => mockState.userName,
  setUserName: (name: string) => ({type: 'setUserName', payload: name}),
}));
jest.mock('../../watermelondb/services', () => ({
  updateUserById: (id: string, f: {username: string}) => mockUpdate(id, f),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => (key === 'common.defaultUserName' ? 'Usuario' : key)}),
}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const {useUserName} = require('../useUserName') as typeof import('../useUserName');

const mount = async () => {
  const latest: {current?: ReturnType<typeof useUserName>} = {};
  const Probe = () => {
    latest.current = useUserName();
    return null;
  };
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<Probe />);
  });
  return latest;
};

beforeEach(() => {
  mockUpdate.mockClear();
  mockDispatch.mockClear();
  mockState.userName = 'User';
});

it('shows the placeholder translated', async () => {
  expect((await mount()).current?.userName).toBe('Usuario');
});

it('keeps the stored placeholder when its translation is saved back unchanged', async () => {
  const hook = await mount();
  await hook.current?.rename('Usuario');
  await hook.current?.rename('  Usuario ');
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

it('saves a real new name', async () => {
  const hook = await mount();
  await hook.current?.rename('Ravi');
  expect(mockUpdate).toHaveBeenCalledWith('u1', {username: 'Ravi'});
  expect(mockDispatch).toHaveBeenCalledWith({type: 'setUserName', payload: 'Ravi'});
});

it('a user really named like the translation can still be saved once they had a different name', async () => {
  mockState.userName = 'Ravi';
  const hook = await mount();
  await hook.current?.rename('Usuario');
  expect(mockUpdate).toHaveBeenCalledWith('u1', {username: 'Usuario'});
});
