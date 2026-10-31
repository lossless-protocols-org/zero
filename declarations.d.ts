declare module '*.svg' {
  import React from 'react';
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// bun-only suites (*.bun.test.ts, see bunfig.toml) exercise real SQLite query
// plans through bun's built-in driver. bun-types is not a dependency, so the
// slice of the API those suites use is declared here.
declare module 'bun:sqlite' {
  export interface Statement<Row> {
    all(...params: Array<string | number | null>): Row[];
    get(...params: Array<string | number | null>): Row | null;
    run(...params: Array<string | number | null>): void;
  }
  export class Database {
    constructor(filename?: string);
    exec(sql: string): void;
    query<Row = Record<string, unknown>>(sql: string): Statement<Row>;
    prepare<Row = Record<string, unknown>>(sql: string): Statement<Row>;
    close(): void;
  }
}

// WatermelonDB's SQLite schema encoder ships without a .d.ts; this is its
// signature as of 0.28.
declare module '@nozbe/watermelondb/adapters/sqlite/encodeSchema' {
  import type {AppSchema} from '@nozbe/watermelondb';
  import type {MigrationStep} from '@nozbe/watermelondb/Schema/migrations';
  export const encodeSchema: (schema: AppSchema) => string;
  /** The SQL the adapter runs for `stepsForMigration(...)` on an existing database. */
  export const encodeMigrationSteps: (steps: MigrationStep[]) => string;
}

// The SQL encoder for a query (no .d.ts either); used by the bun:sqlite plan tests.
declare module '@nozbe/watermelondb/adapters/sqlite/encodeQuery' {
  import type {QueryDescription} from '@nozbe/watermelondb/QueryDescription';
  const encodeQuery: (query: {
    table: string;
    description: QueryDescription;
    associations: unknown[];
  }) => [string, unknown[]];
  export default encodeQuery;
}

// React Native globals its typings do not declare; only what the start-up
// marker (src/utils/startupMarker.ts) uses. nativeLoggingHook is the native
// sink console.* writes to (logcat tag ReactNativeJS / os_log), absent in tests;
// `var` so it appears on globalThis.
declare const performance: {now(): number};
declare var nativeLoggingHook: ((message: string, level: number) => void) | undefined;
