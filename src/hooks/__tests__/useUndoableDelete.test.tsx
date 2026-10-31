/**
 * M13 (v2.7.1): the swipe-delete undo window moved out of TransactionList.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type {AppStateStatus} from 'react-native';
import {useUndoableDelete} from '../useUndoableDelete';

type Api = ReturnType<typeof useUndoableDelete>;

const mount = async (commit: (id: string) => Promise<void>, onCommitFailed: (error: unknown) => Promise<void>) => {
  const latest: {current?: Api} = {};
  const presentIds = ['a', 'b'];
  const Probe = () => {
    latest.current = useUndoableDelete({commit, onCommitFailed, presentIds});
    return null;
  };
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return latest;
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('commits after the undo window, and not at all when undone', async () => {
  const commit = jest.fn(() => Promise.resolve());
  const api = await mount(commit, jest.fn());
  await ReactTestRenderer.act(() => {
    api.current?.schedule('a');
    api.current?.schedule('b');
  });
  expect(api.current?.pendingIds.has('a')).toBe(true);
  await ReactTestRenderer.act(() => {
    api.current?.undo('b');
  });
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(commit.mock.calls).toEqual([['a']]);
  expect(api.current?.removedIds.has('a')).toBe(true);
});

it('puts a row back and reports when the commit fails', async () => {
  const failure = new Error('disk I/O error');
  const onCommitFailed = jest.fn(() => Promise.resolve());
  const api = await mount(() => Promise.reject(failure), onCommitFailed);
  await ReactTestRenderer.act(() => {
    api.current?.schedule('a');
  });
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(onCommitFailed).toHaveBeenCalledWith(failure);
  expect(api.current?.removedIds.has('a')).toBe(false);
});

it('gives a screen-reader user 20 s, not 3 s, to undo (M29)', async () => {
  const {AccessibilityInfo} = require('react-native') as typeof import('react-native'); // the cast names the module's own type
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const commit = jest.fn(() => Promise.resolve());
  const api = await mount(commit, jest.fn());
  await ReactTestRenderer.act(async () => {
    await Promise.resolve(); // let the screen-reader query resolve
  });
  await ReactTestRenderer.act(() => {
    api.current?.schedule('a');
  });
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(commit).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(17000);
  });
  expect(commit).toHaveBeenCalledWith('a');
});

it.each(['background', 'inactive'] as const)(
  'commits pending deletes at once when the app goes %s (a kill inside the window must not resurrect them)',
  async state => {
    const {AppState} = require('react-native') as typeof import('react-native'); // the cast names the module's own type
    let onChange: ((next: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler;
      return {remove};
    });
    const commit = jest.fn(() => Promise.resolve());
    const api = await mount(commit, jest.fn());
    await ReactTestRenderer.act(() => {
      api.current?.schedule('a');
    });
    expect(commit).not.toHaveBeenCalled();
    await ReactTestRenderer.act(async () => {
      onChange?.(state);
    });
    expect(commit).toHaveBeenCalledWith('a');
    // Back in the foreground nothing is pending, so nothing commits twice.
    await ReactTestRenderer.act(async () => {
      onChange?.('active');
      jest.advanceTimersByTime(3000);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  },
);
