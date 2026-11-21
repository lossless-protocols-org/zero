/**
 * Rows only Pro shows are still the user's (3.0 law L9): they can be counted,
 * and removed on request in one write, all or nothing. Tier-blind: nothing
 * here asks who is paying. Real LokiJS database, parts made for the test.
 */
import {database} from '../../../../src/data/database/database';
import {
  countKeptProData,
  PRO_DATA_PARTS,
  removeProData,
  type ProDataPart,
} from '../../../../src/data/services/proDataService';
import * as services from '../../../harness/services';

let userId = '';

beforeEach(async () => {
  await services.deleteAllData();
  userId = await services.createUser('Asha', '');
  await services.createCategory('Food', userId, 'pizza', '#111111', 'expense');
  await services.createCategory('Travel', userId, 'car', '#222222', 'expense');
});

const categories = () => database.get('categories').query().fetch();

/** A part that stands for "every category named so": counted, and removed by deleting. */
const partFor = (name: string): ProDataPart => {
  const mine = async () => (await categories()).filter(row => (row._raw as unknown as {name: string}).name === name);
  return {
    key: name,
    count: async () => (await mine()).length,
    planRemoval: async plan => (await mine()).forEach(row => plan.destroy(row)),
  };
};

it('knows every kind of Pro data the schema has, and an ordinary install has none of it', async () => {
  expect(PRO_DATA_PARTS.map(part => part.key)).toEqual(['incomeCategories', 'accounts', 'recurring', 'monthStart']);
  expect(await countKeptProData()).toBe(0);
  await removeProData();
  expect(await categories()).toHaveLength(3); // the two above and the default income category
});

it('counts every part', async () => {
  expect(await countKeptProData([partFor('Food'), partFor('Travel')])).toBe(2);
  expect(await countKeptProData([partFor('Nothing')])).toBe(0);
});

it('removes every part, and nothing else', async () => {
  const before = (await categories()).length;
  await removeProData([partFor('Food'), partFor('Travel')]);
  const names = (await categories()).map(row => (row._raw as unknown as {name: string}).name);
  expect(names).not.toContain('Food');
  expect(names).not.toContain('Travel');
  expect(names).toHaveLength(before - 2);
});

it('removes all of it or none of it', async () => {
  const before = (await categories()).length;
  const failing: ProDataPart = {
    key: 'failing',
    count: async () => 1,
    planRemoval: async () => {
      throw new Error('could not prepare');
    },
  };
  await expect(removeProData([partFor('Food'), failing])).rejects.toThrow('could not prepare');
  expect(await categories()).toHaveLength(before);
});

it('two parts changing one row make one update with both changes, and deleting wins over updating', async () => {
  const [food] = (await categories()).filter(row => (row._raw as unknown as {name: string}).name === 'Food');
  const [travel] = (await categories()).filter(row => (row._raw as unknown as {name: string}).name === 'Travel');
  // Both rows exist: seeded above.
  const renamed =
    (to: string): ProDataPart['planRemoval'] =>
    async plan =>
      plan.update(food!, row => {
        (row._raw as unknown as {name: string}).name += to;
      });
  const parts: ProDataPart[] = [
    {key: 'a', count: async () => 0, planRemoval: renamed('-a')},
    {key: 'b', count: async () => 0, planRemoval: renamed('-b')},
    {
      key: 'c',
      count: async () => 0,
      planRemoval: async plan => {
        plan.update(travel!, row => {
          (row._raw as unknown as {name: string}).name = 'changed';
        });
        plan.destroy(travel!);
      },
    },
  ];
  await removeProData(parts);
  const names = (await categories()).map(row => (row._raw as unknown as {name: string}).name);
  expect(names).toContain('Food-a-b');
  expect(names).not.toContain('Travel');
  expect(names).not.toContain('changed');
});
