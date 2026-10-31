import {hasMigrationFailed} from '../backend';

/** Whether a data migration gave up; components read it here, not from the backend. */
export const useMigrationFailed = (): boolean => hasMigrationFailed();
