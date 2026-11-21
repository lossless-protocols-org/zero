import {useSyncExternalStore} from 'react';
import {capsOf, type ProFeature} from '../../pro/features';
import {getAppliedPro, subscribeAppliedPro} from '../../pro/proGate';

/** Whether Pro is applied to what is drawn now (a downgrade waits for a safe point: src/pro/proGate.ts). */
export const useAppliedPro = (): boolean => useSyncExternalStore(subscribeAppliedPro, getAppliedPro, getAppliedPro);

/**
 * Whether one Pro feature is on. The only question a screen asks about the
 * tier (plan rule 3); services, schema, export and import never ask.
 */
export const useProFeature = (feature: ProFeature): boolean => capsOf(useAppliedPro()).has(feature);
