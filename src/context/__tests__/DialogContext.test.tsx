/**
 * M5 (v2.7.1): `dismiss` was not idempotent. A double tap on OK during the
 * 400 ms fade scheduled `showNext` twice; with a dialog queued, the second
 * call cleared `activeRef` under the dialog it had just presented, so that
 * dialog's OK resolved nothing and its caller's `await showDialog()` (the
 * delete-all gate, settle-up, budget remove) never resumed. Pending promises
 * are now also rejected if the provider unmounts.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {DialogProvider, DialogUnmountedError, useDialog} from '../DialogContext';
import {DialogView} from '../../components/molecules/DialogView';
import {ThemeProvider} from '../ThemeContext';

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

const wait = (ms: number) =>
  ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), ms));
  });

/** The OK handler of the dialog on screen; a double tap is this called twice before re-render. */
const okHandler = (renderer: ReactTestRenderer.ReactTestRenderer): (() => void) => {
  const ok = renderer.root.findAll(
    node => node.props['accessibilityLabel'] === 'common.ok' && typeof node.props['onPress'] === 'function',
  );
  const handler: unknown = ok[ok.length - 1]?.props['onPress'];
  if (typeof handler !== 'function') {
    throw new Error('no OK button');
  }
  return () => {
    ReactTestRenderer.act(() => {
      handler();
    });
  };
};

const pressOk = (renderer: ReactTestRenderer.ReactTestRenderer): void => {
  const ok = renderer.root.findAll(
    node => node.props['accessibilityLabel'] === 'common.ok' && typeof node.props['onPress'] === 'function',
  );
  const button = ok[ok.length - 1];
  if (!button) {
    const labels = renderer.root
      .findAll(node => typeof node.props['accessibilityLabel'] === 'string')
      .map(node => String(node.props['accessibilityLabel']));
    throw new Error(`no OK button; labels: ${labels.join(', ')}`);
  }
  ReactTestRenderer.act(() => {
    button.props['onPress']();
  });
};

const mount = async (): Promise<ReactTestRenderer.ReactTestRenderer> => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <DialogProvider DialogView={DialogView}>
          <Capture />
        </DialogProvider>
      </ThemeProvider>,
    );
  });
  if (!renderer) {
    throw new Error('render failed');
  }
  return renderer;
};

describe('DialogContext (M5)', () => {
  it('OK tapped twice during the fade still lets the queued dialog resolve', async () => {
    const renderer = await mount();
    const settled: string[] = [];
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    await ReactTestRenderer.act(() => {
      first = api().showDialog({message: 'first'});
      second = api().showDialog({message: 'second'});
    });
    void first?.then(v => settled.push(`first:${v}`));
    void second?.then(v => settled.push(`second:${v}`));

    const tap = okHandler(renderer);
    tap();
    tap(); // the double tap, inside the 400 ms fade
    await wait(450);
    expect(settled).toEqual(['first:true']);

    pressOk(renderer); // OK on the queued dialog
    await wait(10);
    expect(settled).toEqual(['first:true', 'second:true']);
    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it('unmounting the provider rejects every pending dialog promise', async () => {
    const renderer = await mount();
    let active: Promise<boolean> | undefined;
    let queued: Promise<void> | undefined;
    await ReactTestRenderer.act(() => {
      active = api().showDialog({message: 'active'});
      queued = api().showAlert({message: 'queued'});
    });
    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
    const within = <T,>(promise: Promise<T> | undefined) =>
      Promise.race([promise, new Promise<'still pending'>(resolve => setTimeout(() => resolve('still pending'), 100))]);
    await expect(within(active)).rejects.toBeInstanceOf(DialogUnmountedError);
    await expect(within(queued)).rejects.toBeInstanceOf(DialogUnmountedError);
  });
});
