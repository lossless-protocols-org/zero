import {useEffect} from 'react';

/**
 * React Navigation's useFocusEffect with no navigator: a screen is focused
 * once it mounts. For hooks that refetch on focus, rendered alone:
 *
 *   jest.mock('@react-navigation/native', () => ({
 *     ...jest.requireActual('@react-navigation/native'),
 *     ...require('<…>/harness/mocks/focusEffect'),
 *   }));
 */
export const useFocusEffect = (effect: () => void | (() => void)): void => useEffect(effect, [effect]);
