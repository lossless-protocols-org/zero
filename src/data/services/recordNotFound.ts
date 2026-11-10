/**
 * WatermelonDB 0.28 has no typed not-found error: `Collection.find` throws
 * exactly `Record <table>#<id> not found`. True only for that, so a real
 * database failure is never read as "the row is gone".
 */
export const isRecordNotFound = (error: unknown): boolean =>
  error instanceof Error && /^Record \w+#\S+ not found$/.test(error.message);
