/**
 * M28 (v2.7.1): the dialog read as a single "Close" button — the scrim was a
 * labelled button wrapping the card — so screen readers never reached the
 * message or OK/Cancel of any confirmation, and nothing announced on open.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AccessibilityInfo} from 'react-native';

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('../../../hooks/useThemeColors', () => ({
  __esModule: true,
  default: () => ({
    accentGreen: '#00aa00',
    accentOrange: '#aa6600',
    accentRed: '#aa0000',
    accentBlue: '#0000aa',
    secondaryAccent: '#eeeeee',
    primaryText: '#111111',
    secondaryText: '#777777',
    buttonText: '#ffffff',
    sameWhite: '#ffffff',
    sameBlack: '#000000',
  }),
}));

// required after jest.mock so the mocks apply; the cast names the module's own type
const {DialogView} = require('../DialogView') as typeof import('../DialogView');

const render = async (onClose = jest.fn()) => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DialogView
        visible
        dialog={{type: 'warning', message: 'Settle ₹500 with Ravi?', showCancel: true}}
        onClose={onClose}
      />,
    );
  });
  return {root: renderer!.root, onClose, announce}; // created in act above
};

it('no wrapper is one big button: nothing labelled "Close" grabs the card', async () => {
  const {root} = await render();
  expect(root.findAll(node => node.props['accessibilityLabel'] === 'common.close')).toHaveLength(0);
  // Every pressable wrapper around the card is hidden from assistive tech itself.
  const wrappers = root.findAll(
    node => typeof node.props['onPress'] === 'function' && node.props['accessibilityRole'] === undefined,
  );
  expect(wrappers.every(node => node.props['accessible'] === false)).toBe(true);
  // And not focusable on Android either: a clickable wrapper gathers its
  // children's text and TalkBack read the message twice (seen on the Moto).
  expect(wrappers.length).toBeGreaterThanOrEqual(2);
  expect(wrappers.every(node => node.props['importantForAccessibility'] === 'no')).toBe(true);
});

it('the message is an alert that says what kind of dialog it is, read once when focus lands on it', async () => {
  const {root, announce} = await render();
  const alert = root.find(node => node.props['accessibilityRole'] === 'alert' && typeof node.type === 'string');
  expect(alert.props['accessibilityLabel']).toBe('dialog.typeWarning: Settle ₹500 with Ravi?');
  // The modal window moves focus to its first readable element, which reads it;
  // an announcement or a live region on top made TalkBack say it twice.
  const readable = root.findAll(
    node => typeof node.type === 'string' && (node.props['accessibilityLabel'] || node.props['accessibilityRole']),
  );
  expect(readable[0]).toBe(alert);
  expect(announce).not.toHaveBeenCalled();
  expect(alert.props['accessibilityLiveRegion']).toBeUndefined();
});

it('both buttons are reachable, and the escape gesture cancels', async () => {
  const {root, onClose} = await render();
  expect(
    root
      .findAll(node => node.props['accessibilityRole'] === 'button' && typeof node.type === 'string')
      .map(n => n.props['accessibilityLabel']),
  ).toEqual(['common.cancel', 'common.ok']);
  const modalCard = root.find(node => node.props['accessibilityViewIsModal'] === true && typeof node.type === 'string');
  modalCard.props['onAccessibilityEscape']();
  expect(onClose).toHaveBeenCalledWith(false);
});
