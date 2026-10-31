/**
 * L4 (v2.7.1): the JSON backup is written without pretty-printing (219 vs
 * 123 B/row on a real file), and `getAllData` reads expenses and debts as raw
 * rows instead of hydrating a model per row it only copies. Neither may change
 * the content: a backup exported from an imported seed must re-import to the
 * same data, and the export of that re-import must be identical. LokiJS
 * harness as in importService.test.ts.
 */
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import Query from '@nozbe/watermelondb/Query';
import type {ExportData} from '../src/backend/export/format';

jest.mock('../src/watermelondb/database', () =>
  require('../src/testing/lokiDatabase').lokiDatabaseModule('exportRoundTripTest'),
);

// required after jest.mock so the mock applies; each cast names the module's own type
const {importAllData} =
  require('../src/watermelondb/services/importService') as typeof import('../src/watermelondb/services/importService');
const {getAllData} =
  require('../src/watermelondb/services/getService') as typeof import('../src/watermelondb/services/getService');
const {validateExportEnvelope} =
  require('../src/backend/export/validate') as typeof import('../src/backend/export/validate');
const {upgradeExportData} =
  require('../src/backend/export/upgrader') as typeof import('../src/backend/export/upgrader');
const {exportJson} =
  require('../src/screens/SettingsScreen/exportFiles') as typeof import('../src/screens/SettingsScreen/exportFiles');
const {CURRENT_EXPORT_VERSION} =
  require('../src/backend/export/format') as typeof import('../src/backend/export/format');

const {execFileSync} = require('child_process');
const {mkdtempSync, readFileSync} = require('fs');
const {tmpdir} = require('os');
const {join, resolve} = require('path');
declare const __dirname: string;

const writeFile = jest.mocked(RNFS.writeFile);

const loadSeed = (count: number): ExportData => {
  const dir = mkdtempSync(join(tmpdir(), 'zero-l4-'));
  const out = join(dir, `seed_${count}.json`);
  execFileSync('node', [resolve(__dirname, '../scripts/seed-backup.mjs'), String(count), '--compact', '--out', out]);
  const validation = validateExportEnvelope(JSON.parse(readFileSync(out, 'utf8')));
  if (!validation.success || !validation.data) {
    throw new Error(validation.error ?? 'seed did not validate');
  }
  return upgradeExportData(validation.data);
};

const exportViaScreen = async (): Promise<string> => {
  writeFile.mockClear();
  jest.replaceProperty(Platform, 'OS', 'android');
  const outcome = await exportJson({
    getAllData,
    handleExportResult: async () => {},
    requestStoragePermission: async () => true,
    requestStorageViaDialog: async () => {},
    shareTitle: 'Export',
    noUserMessage: 'no user',
    invalidRowMessage: (detail: string) => detail,
  });
  expect(outcome).toBe('saved');
  const contents = writeFile.mock.calls[0]?.[1];
  if (typeof contents !== 'string') {
    throw new Error('nothing was written');
  }
  return contents;
};

describe('export round trip (L4)', () => {
  jest.setTimeout(120_000);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports compact JSON that re-imports to identical content, and reads expenses/debts as raw rows', async () => {
    const seed = loadSeed(2000);
    await importAllData(seed);

    // Record which tables are read raw vs hydrated during one export.
    const rawTables: string[] = [];
    const hydratedTables: string[] = [];
    const originalRaw = Query.prototype.unsafeFetchRaw;
    const originalFetch = Query.prototype.fetch;
    jest.spyOn(Query.prototype, 'unsafeFetchRaw').mockImplementation(function (this: Query<never>) {
      rawTables.push(this.table);
      return originalRaw.call(this);
    });
    jest.spyOn(Query.prototype, 'fetch').mockImplementation(function (this: Query<never>) {
      hydratedTables.push(this.table);
      return originalFetch.call(this);
    });

    const first = await exportViaScreen();
    jest.restoreAllMocks();

    expect(rawTables.sort()).toEqual(['debts', 'expenses']);
    expect(hydratedTables).not.toContain('expenses');
    expect(hydratedTables).not.toContain('debts');

    // Indent-free: no newlines, no indentation.
    expect(first).not.toContain('\n');
    // the export this test just wrote, already validated above
    const envelope = JSON.parse(first) as {key: string; version: number; data: ExportData};
    expect(envelope.version).toBe(CURRENT_EXPORT_VERSION);
    const perRow =
      first.length /
      (seed.expenses.length +
        seed.categories.length +
        seed.debtors.length +
        seed.debts.length +
        seed.budgets.length +
        2);
    console.log(`[L4] export of ${seed.expenses.length} expenses: ${first.length} B, ${perRow.toFixed(0)} B/row`);
    expect(perRow).toBeLessThan(140);

    // Content round trip: import what was exported, export again, compare data byte for byte.
    const validation = validateExportEnvelope(envelope);
    if (!validation.success || !validation.data) {
      throw new Error(validation.error ?? 'exported file did not validate');
    }
    await importAllData(upgradeExportData(validation.data));
    const second = await exportViaScreen();
    // both inputs are export files the test just wrote, so `data` is there
    const strip = (json: string): string => JSON.stringify((JSON.parse(json) as {data: unknown}).data);
    expect(strip(second)).toBe(strip(first));

    // And the seed's own content survived the first import (modulo key order of the envelope).
    const original = JSON.stringify(seed);
    expect(strip(first)).toBe(original);
  });
});
