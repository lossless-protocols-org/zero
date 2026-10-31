/**
 * Preload for `bun test` (see bunfig.toml). Bun does not hoist jest.mock and
 * has no transform pipeline for react-native's Flow-typed sources, so native
 * modules must be mocked BEFORE any test file imports them.
 *
 * jest (`bun run test`) remains the canonical runner — it covers the full
 * suite including the App render smoke test, which bun cannot parse. The
 * pure suites (planner, upgrader, sanitize, numberUtils, expenseService)
 * run under both. `bun run test:unit` / `test:rn` split the two (M23).
 *
 * Lint-only on purpose: this file is outside tsconfig's `include`, because
 * typechecking `bun:test` would need `@types/bun` as a new dev dependency.
 */
import {mock} from 'bun:test';
import * as localizeMock from './src/testing/localizeMock';
import * as mmkvMock from './src/testing/mmkvMock';

// React Native's own preset defines __DEV__ for jest; bun has no such global,
// so app code guarded by `if (__DEV__)` throws a ReferenceError without this.
(globalThis as {__DEV__?: boolean}).__DEV__ = false;

mock.module('react-native-localize', () => localizeMock);
mock.module('react-native-mmkv', () => mmkvMock);
