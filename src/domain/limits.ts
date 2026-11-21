/**
 * The bounds a stored row must meet, shared by the services that write rows
 * and the backup check that reads them (src/data/backup/export/validate.ts).
 * They must agree: a row a service stored and the check refused would stop
 * every later export, and a row the check let in that a service would refuse
 * could not be edited.
 *
 * 10^13 is above the UI's largest amount; 200 characters is far above every
 * text field's UI cap while refusing multi-kilobyte blobs.
 */
export const MAX_AMOUNT = 1e13;
export const MAX_TEXT = 200;
