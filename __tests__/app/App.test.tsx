/**
 * The whole app mounts: store, theme, dialogs, navigation and the start-up
 * probe, on the LokiJS database jest.setup.js installs. A fresh install (no
 * user row) lands on Welcome. It used to render a stub database and assert
 * nothing, so it passed whatever the tree showed (audit 2026-11-08 §7.5).
 */
import React from 'react';
import {render, screen} from '@testing-library/react-native';
import App from '../../App';

it('a fresh install opens on Welcome, ready to start', async () => {
  await render(<App />);
  // Nothing to migrate on a new install: no "Updating" screen (schemaUpgrade.test.tsx has the other side).
  expect(screen.queryByText('Updating your data…')).toBeNull();
  expect(await screen.findByText('Get Started')).toBeOnTheScreen();
  expect(screen.getByText('Count every penny.')).toBeOnTheScreen();
});
