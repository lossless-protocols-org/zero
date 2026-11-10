/**
 * M5 (v2.7.1): `dismiss` was not idempotent. A double tap on OK during the
 * 400 ms fade scheduled `showNext` twice; with a dialog queued, the second
 * call cleared `activeRef` under the dialog it had just presented, so that
 * dialog's OK resolved nothing and its caller's `await showDialog()` (the
 * delete-all gate, settle-up, budget remove) never resumed. Pending promises
 * are now also rejected if the provider unmounts.
 */
import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {DialogProvider, DialogUnmountedError, useDialog} from '../../../../src/ui/context/DialogContext';
import {DialogView} from '../../../../src/ui/molecules/DialogView';
import {ThemeProvider} from '../../../../src/ui/context/ThemeContext';
import {handlerOf} from '../../../harness/handlers';

type DialogApi = ReturnType<typeof useDialog>;
const holder: {api: DialogApi | null} = {api: null};

const Capture = () => {
  holder.api = useDialog();
  return null;
};

const api = (): DialogApi => {
  if (!holder.api) {
    throw new Error('provider not mounted');
  }
  return holder.api;
};

const wait = (ms: number) => act(() => new Promise<void>(resolve => setTimeout(() => resolve(), ms)));

/** The OK button of the dialog on screen (the last one, while one fades out). */
const okButton = () => screen.getAllByLabelText('common.ok').at(-1) ?? screen.getByLabelText('common.ok');

const mount = () =>
  render(
    <ThemeProvider>
      <DialogProvider DialogView={DialogView}>
        <Capture />
      </DialogProvider>
    </ThemeProvider>,
  );

describe('DialogContext', () => {
  it('OK tapped twice during the fade still lets the queued dialog resolve', async () => {
    await mount();
    const settled: string[] = [];
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    await act(() => {
      first = api().showDialog({message: 'first'});
      second = api().showDialog({message: 'second'});
    });
    void first?.then(v => settled.push(`first:${v}`));
    void second?.then(v => settled.push(`second:${v}`));

    // The double tap, inside the 400 ms fade: the same OK handler twice before React re-renders.
    const ok = handlerOf(okButton(), 'onPress');
    await act(() => {
      ok();
      ok();
    });
    await wait(450);
    expect(settled).toEqual(['first:true']);

    await fireEvent.press(okButton()); // OK on the queued dialog
    await wait(10);
    expect(settled).toEqual(['first:true', 'second:true']);
  });

  it('unmounting the provider rejects every pending dialog promise', async () => {
    const {unmount} = await mount();
    let active: Promise<boolean> | undefined;
    let queued: Promise<void> | undefined;
    await act(() => {
      active = api().showDialog({message: 'active'});
      queued = api().showAlert({message: 'queued'});
    });
    const within = <T,>(promise: Promise<T> | undefined) =>
      Promise.race([promise, new Promise<'still pending'>(resolve => setTimeout(() => resolve('still pending'), 100))]);
    // Listen before the unmount rejects them, as a caller awaiting the dialog does.
    const outcomes = Promise.allSettled([within(active), within(queued)]);
    await unmount();
    for (const outcome of await outcomes) {
      expect(outcome.status === 'rejected' && outcome.reason instanceof DialogUnmountedError).toBe(true);
    }
  });
});
