/**
 * Reports header: the month pill shares a row with the Total and Avg/day tiles
 * when the phone is wide enough for both amounts to stay readable; on a narrow
 * phone (an iPhone SE, a 320 dp Android) the pill takes its own row.
 */
import {reportsHeaderLayout} from '../../../../../../src/features/reports/screens/ReportsScreen/headerLayout';

it('stacks below 360 dp and shares one row from 360 dp', () => {
  expect(reportsHeaderLayout(320, 1)).toBe('stacked');
  expect(reportsHeaderLayout(359.9, 1)).toBe('stacked');
  expect(reportsHeaderLayout(360, 1)).toBe('row');
  expect(reportsHeaderLayout(432, 1)).toBe('row');
  expect(reportsHeaderLayout(820, 1)).toBe('row');
});

it('counts the system text size: large text on a wide phone stacks too (iPhone 16, Accessibility L)', () => {
  expect(reportsHeaderLayout(393, 1)).toBe('row');
  expect(reportsHeaderLayout(393, 1.2)).toBe('stacked');
  expect(reportsHeaderLayout(393, 2.35)).toBe('stacked');
  // A smaller-than-default text size never makes a narrow phone look wide.
  expect(reportsHeaderLayout(320, 0.82)).toBe('stacked');
});
