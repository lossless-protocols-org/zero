/**
 * The widget's links resolve to the add screens on top of the tab stack, so
 * Back from a widget-opened form lands on Home (2.8 Phase 3).
 */
import {getStateFromPath} from '@react-navigation/native';
import {deepLinking} from '../../../src/navigation/linking';

const resolve = (path: string) => getStateFromPath(path, deepLinking.config);

it.each([
  ['add', 'AddTransactionsScreen'],
  ['money/add', 'AddIncomeScreen'],
])('zero://%s opens %s above the tabs', (path, screen) => {
  expect(resolve(path)?.routes.map(r => r.name)).toEqual(['TabStack', screen]);
});

it('an unknown link opens no add screen', () => {
  const names = resolve('settings/delete-everything')?.routes.map(r => r.name) ?? [];
  expect(names.filter(n => n === 'AddTransactionsScreen' || n === 'AddIncomeScreen')).toEqual([]);
});

it('zero://quick carries the entry kind and a chip category to the sheet over the tabs', () => {
  const state = resolve('quick?kind=expense&categoryId=cat_food');
  expect(state?.routes.map(r => r.name)).toEqual(['TabStack', 'QuickAddScreen']);
  expect(state?.routes[1]?.params).toEqual({kind: 'expense', categoryId: 'cat_food'});
});

it('zero://money/add keeps a real month and drops anything else (any app can send a link)', () => {
  expect(resolve('money/add?yearMonth=2026-10')?.routes[1]?.params).toEqual({yearMonth: '2026-10'});
  for (const bad of ['garbage', '2026-13', '2026-1', '26-10', '2026-10-05', '%00']) {
    const params = resolve(`money/add?yearMonth=${bad}`)?.routes[1]?.params as {yearMonth?: string} | undefined; // the screen's own param shape
    expect({bad, yearMonth: params?.yearMonth}).toEqual({bad, yearMonth: undefined});
  }
});

describe('zero://quick filled in ("Add again" from the iPhone Home Screen quick actions)', () => {
  it('carries the amount and title to the sheet', () => {
    const state = resolve('quick?kind=expense&categoryId=cat_food&amount=20&title=Chai%20%26%20bun');
    expect(state?.routes[1]?.params).toEqual({
      kind: 'expense',
      categoryId: 'cat_food',
      amount: '20',
      title: 'Chai & bun',
    });
  });

  it.each(['12.5', '0.01', '999999999999'])('keeps the plain amount %s', amount => {
    expect(resolve(`quick?amount=${amount}`)?.routes[1]?.params).toEqual({amount});
  });

  it.each(['0', '-5', '1e5', '20abc', '12.1234567', '1,000', '', '%20', 'NaN'])(
    'drops the amount %j: any app can send a link',
    amount => {
      const params = resolve(`quick?amount=${encodeURIComponent(amount)}`)?.routes[1]?.params as
        {amount?: string} | undefined; // QuickAddScreen params
      expect(params?.amount).toBeUndefined();
    },
  );

  it('trims the title, cuts it at 100 characters and drops a blank one', () => {
    const long = 'x'.repeat(150);
    const params = (t: string) =>
      resolve(`quick?title=${encodeURIComponent(t)}`)?.routes[1]?.params as {title?: string} | undefined; // QuickAddScreen params
    expect(params(long)?.title).toHaveLength(100);
    expect(params('  Metro  ')?.title).toBe('Metro');
    expect(params('   ')?.title).toBeUndefined();
  });
});
