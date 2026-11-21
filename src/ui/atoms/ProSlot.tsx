import React from 'react';
import type {ProFeature} from '../../pro/features';
import {useProFeature} from '../hooks/useProFeature';

interface ProSlotProps {
  feature: ProFeature;
  children: React.ReactNode;
}

/**
 * A Pro section inside a free screen (3.0 law L8): its children are rendered
 * only while the feature is on. Without Pro it renders nothing at all: no
 * lock, no badge, no teaser (plan rule 6). The one upgrade entry is in Settings.
 * The first sections arrive with plan P8 (knip.jsonc lists this file until then).
 */
export const ProSlot: React.FC<ProSlotProps> = ({feature, children}) =>
  useProFeature(feature) ? <>{children}</> : null;
