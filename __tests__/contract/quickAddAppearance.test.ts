/**
 * The Android quick-add sheet shares the app's one React instance. When the
 * phone switched light/dark while zero sat in the background, nothing passed
 * the change on (a new QuickAddActivity starts with the new configuration but
 * gets no onConfigurationChanged), and the next sheet drew in the old theme
 * (Moto, 2026-11-09). The activity tells React on every resume; React's
 * Appearance module emits only when the scheme really changed.
 *
 * Driving a ReactActivity needs the native React runtime, which neither jest
 * nor Robolectric loads, so the wiring is pinned here and the behaviour was
 * checked on the emulator (theme switched with the app in the background).
 */
import fs from 'node:fs';
import {fromRoot} from '../harness/paths';

const activity = fs.readFileSync(
  fromRoot('android', 'app', 'src', 'main', 'java', 'com', 'anotherwhy', 'zero', 'quickadd', 'QuickAddActivity.kt'),
  'utf8',
);
const manifest = fs.readFileSync(fromRoot('android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

it('handles theme changes itself, so it must pass them on', () => {
  const entry = manifest.slice(manifest.indexOf('.quickadd.QuickAddActivity'));
  expect(entry.slice(0, entry.indexOf('/>'))).toMatch(/configChanges="[^"]*uiMode/);
});

it('brings React up to date with the current theme each time the sheet resumes', () => {
  const onResume = activity.slice(activity.indexOf('override fun onResume()'));
  expect(onResume).toMatch(
    /^override fun onResume\(\) \{\s*super\.onResume\(\)\s*reactHost\?\.onConfigurationChanged\(this\)/,
  );
});
