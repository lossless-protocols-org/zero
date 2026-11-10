/**
 * Schema v5: every table has a registered model, and every model declares
 * createdAt / updatedAt. WatermelonDB maintains the two columns only when the
 * model class declares them (Model/helpers.js checks `'createdAt' in model`),
 * so a model that forgot the decorators would store 0 forever.
 */
import {schema} from '../../../../../src/data/database/schema';
import {MODEL_CLASSES} from '../../../../../src/data/database/models/modelClasses';

describe('model registry', () => {
  it('registers exactly one model per schema table', () => {
    expect(MODEL_CLASSES.map(m => m.table).sort()).toEqual(Object.keys(schema.tables).sort());
  });

  it.each(MODEL_CLASSES.map(m => [m.table, m] as const))('%s declares createdAt and updatedAt', (_table, model) => {
    expect('createdAt' in model.prototype).toBe(true);
    expect('updatedAt' in model.prototype).toBe(true);
  });

  it('every table has the two timestamp columns', () => {
    for (const table of Object.values(schema.tables)) {
      expect({
        table: table.name,
        created: table.columns['created_at']?.type,
        updated: table.columns['updated_at']?.type,
      }).toEqual({
        table: table.name,
        created: 'number',
        updated: 'number',
      });
    }
  });
});
