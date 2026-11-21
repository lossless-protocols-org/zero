import {createAction} from '@reduxjs/toolkit';

/**
 * The day months start on changed (3.0, plan P11): the user picked another
 * day, or Pro turned on or off (src/pro/monthStart.ts). Every month slot was
 * read for the old boundaries, so the slices that hold months drop them, and
 * the month on screen becomes the one today is in. A fetch still in flight
 * for the old boundaries finds its slot gone and is dropped as it lands.
 */
export const monthStartChanged = createAction('session/monthStartChanged', (now: Date = new Date()) => ({
  payload: {now: now.getTime()},
}));
