/**
 * Found on the iPhone 16 (2.7.1 iOS pass): the tab buttons were 37 pt tall —
 * the bar subtracted 20 pt on iOS only. The content area must hold a 44 pt
 * target on both platforms, with the home indicator / nav bar below it.
 */
import {tabBarLayout} from '../tabBarLayout';

const content = (l: {height: number; paddingTop: number; paddingBottom: number}) =>
  l.height - l.paddingTop - l.paddingBottom;

it.each([
  ['ios', 34],
  ['ios', 0],
  ['android', 0],
  ['android', 24],
] as const)('%s with a %d pt bottom inset leaves at least 44 pt for the tabs', (os, inset) => {
  const layout = tabBarLayout(inset, os);
  expect(content(layout)).toBeGreaterThanOrEqual(44);
  expect(layout.paddingBottom).toBeGreaterThanOrEqual(inset);
});

it('keeps the Android bar as it was', () => {
  expect(tabBarLayout(0, 'android')).toEqual({height: 73, paddingTop: 8, paddingBottom: 8});
});
