/**
 * Preload for `bun test`, which runs only the SQLite suites (__tests__/sqlite;
 * see bunfig.toml). Native modules they reach are mocked here, before any
 * test file imports them. Every other suite runs under jest (`bun run test`).
 *
 * Lint-only on purpose: this file is outside tsconfig's `include`, because
 * typechecking `bun:test` would need `@types/bun` as a new dev dependency.
 */
import {mock} from 'bun:test';
import * as localizeMock from './__tests__/harness/mocks/localize';
import * as mmkvMock from './__tests__/harness/mocks/mmkv';

// React Native's own preset defines __DEV__ for jest; bun has no such global,
// so app code guarded by `if (__DEV__)` throws a ReferenceError without this.
(globalThis as {__DEV__?: boolean}).__DEV__ = false;

mock.module('react-native-localize', () => localizeMock);
mock.module('react-native-mmkv', () => mmkvMock);
