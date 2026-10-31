import {sanitizeString, DEFAULTS} from '../../utils/sanitize';
import {COLOR_REMAP} from '../migrations/colorRemap';
import {CURRENT_EXPORT_VERSION, type ExportData} from './format';

/** A file's data before upgrading: files older than v4 have no budgets. */
type RawExportData = Omit<ExportData, 'budgets'> & {budgets?: ExportData['budgets']};

interface RawExport {
  key: string;
  version?: number;
  data: RawExportData;
}

/**
 * Upgrades an imported export file to the current format version.
 * Applies sequential transformations: v0→v1, v1→v2, etc.
 *
 * Legacy files (exported before versioning) have no `version` field
 * and are treated as version 0.
 */
export const upgradeExportData = (raw: RawExport): ExportData => {
  let data = raw.data;
  let version = raw.version ?? 0;

  if (version < 1) {
    data = upgradeV0toV1(data);
    version = 1;
  }

  if (version < 2) {
    data = upgradeV1toV2(data);
    version = 2;
  }

  if (version < 3) {
    data = upgradeV2toV3(data);
    version = 3;
  }

  // v3 → v4 added the budgets table; older files have none.
  const upgraded: ExportData = {...data, budgets: data.budgets ?? []};
  version = Math.max(version, 4);

  if (__DEV__ && version < CURRENT_EXPORT_VERSION) {
    console.warn(`Export format v${version} is behind current v${CURRENT_EXPORT_VERSION}`);
  }

  return upgraded;
};

/** Shared sanitization pass for icon/color/type across categories and debtors. */
const sanitizeEntities = (data: RawExportData): RawExportData => ({
  ...data,
  categories: data.categories.map(c => ({
    ...c,
    icon: sanitizeString(c.icon, DEFAULTS.icon),
    color: sanitizeString(c.color, DEFAULTS.color),
  })),
  debtors: data.debtors.map(d => ({
    ...d,
    icon: sanitizeString(d.icon, DEFAULTS.icon),
    type: sanitizeString(d.type, DEFAULTS.type),
    color: sanitizeString(d.color, DEFAULTS.color),
  })),
});

/**
 * v0 → v1: Sanitize poisoned icon/color values in categories and debtors.
 * Legacy exports stored literal "null" strings for missing icon/color.
 */
const upgradeV0toV1 = (data: RawExportData): RawExportData => sanitizeEntities(data);

/**
 * v1 → v2: Aligns with DB schema v2. Same entity shape — re-sanitize pass
 * to guarantee all values meet the v2 contract.
 */
const upgradeV1toV2 = (data: RawExportData): RawExportData => sanitizeEntities(data);

const remapColor = (color: string | undefined): string | undefined => {
  if (!color) {
    return color;
  }
  return COLOR_REMAP[color.toUpperCase()] ?? color;
};

/**
 * v2 → v3: WCAG 2.2 color compliance. Remaps old category/debtor colors
 * to the new accessible palette. Colors not in the remap table are untouched.
 */
const upgradeV2toV3 = (data: RawExportData): RawExportData => ({
  ...data,
  categories: data.categories.map(c => ({
    ...c,
    color: remapColor(c.color),
  })),
  debtors: data.debtors.map(d => ({
    ...d,
    color: remapColor(d.color),
  })),
});
