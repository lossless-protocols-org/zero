/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// The SQLite JSI adapter needs a native runtime; stub the app's database
// module so the tree renders instead of the DatabaseErrorFallback.
jest.mock('../src/watermelondb/database', () => ({
  database: {
    // The start-up probe counts the users table (M3); every other access
    // yields empty results so the tree renders instead of the fallback.
    get: jest.fn(() => ({
      query: () => ({fetchCount: async () => 0, fetch: async () => [], unsafeFetchRaw: async () => []}),
      find: async () => {
        throw new Error('no database in the render smoke test');
      },
    })),
    write: jest.fn(async (work: () => Promise<unknown>) => work()),
    batch: jest.fn(),
  },
  getDatabaseError: () => null,
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
