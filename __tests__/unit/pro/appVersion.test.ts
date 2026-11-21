import {majorOf, PRO_MAJOR} from '../../../src/pro/appVersion';

it('reads the major number of a version, or nothing', () => {
  expect(majorOf('2.8.0')).toBe(2);
  expect(majorOf('3.0.0')).toBe(3);
  expect(majorOf('10.1')).toBe(10);
  for (const unreadable of [null, '', 'three', 'v3.0', '3', '.5']) {
    expect(majorOf(unreadable)).toBeNull();
  }
});

it('zero Pro arrived in 3', () => {
  expect(PRO_MAJOR).toBe(3);
});
