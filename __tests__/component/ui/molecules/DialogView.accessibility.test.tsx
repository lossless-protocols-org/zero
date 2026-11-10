/**
 * M28 (v2.7.1): the dialog read as a single "Close" button — the scrim was a
 * labelled button wrapping the card — so screen readers never reached the
 * message or OK/Cancel of any confirmation, and nothing announced on open.
 */
import React from 'react';
import {fireEvent, screen} from '@testing-library/react-native';
import {AccessibilityInfo} from 'react-native';
import {DialogView} from '../../../../src/ui/molecules/DialogView';
import {renderWithTheme} from '../../../harness/render';
import {setMockTranslations} from '../../../harness/mocks/reactI18next';

jest.mock('react-i18next', () => require('../../../harness/mocks/reactI18next'));
beforeAll(() => setMockTranslations({'dialog.spoken': '{{type}}: {{message}}'}));

const show = async (onClose = jest.fn()) => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await renderWithTheme(
    <DialogView
      visible
      dialog={{type: 'warning', message: 'Settle ₹500 with Ravi?', showCancel: true}}
      onClose={onClose}
    />,
  );
  // Host elements only (what assistive tech sees).
  const all = screen.container.queryAll(() => true);
  return {all, onClose, announce};
};

it('no wrapper is one big button: nothing labelled "Close" grabs the card', async () => {
  const {all} = await show();
  expect(screen.queryByLabelText('common.close', {includeHiddenElements: true})).toBeNull();
  // Every pressable wrapper around the card is hidden from assistive tech itself.
  const wrappers = all.filter(
    node => typeof node.props['onClick'] === 'function' && node.props['accessibilityRole'] === undefined,
  );
  // And not focusable on Android either: a clickable wrapper gathers its
  // children's text and TalkBack read the message twice (seen on the Moto).
  expect(wrappers.length).toBeGreaterThanOrEqual(2);
  expect(wrappers.every(node => node.props['accessible'] === false)).toBe(true);
  expect(wrappers.every(node => node.props['importantForAccessibility'] === 'no')).toBe(true);
});

it('the message is an alert that says what kind of dialog it is, read once when focus lands on it', async () => {
  const {all, announce} = await show();
  const alert = screen.getByRole('alert');
  expect(alert.props['accessibilityLabel']).toBe('dialog.typeWarning: Settle ₹500 with Ravi?');
  // The modal window moves focus to its first readable element, which reads it;
  // an announcement or a live region on top made TalkBack say it twice.
  const readable = all.filter(node => node.props['accessibilityLabel'] || node.props['accessibilityRole']);
  expect(readable[0]).toBe(alert);
  expect(announce).not.toHaveBeenCalled();
  expect(alert.props['accessibilityLiveRegion']).toBeUndefined();
});

it('both buttons are reachable, and the escape gesture cancels', async () => {
  const {all, onClose} = await show();
  expect(screen.getAllByRole('button').map(n => n.props['accessibilityLabel'])).toEqual(['common.cancel', 'common.ok']);
  const modalCard = all.find(node => node.props['accessibilityViewIsModal'] === true);
  if (!modalCard) {
    throw new Error('no modal card');
  }
  await fireEvent(modalCard, 'accessibilityEscape');
  expect(onClose).toHaveBeenCalledWith(false);
});
