import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {afterInteractions} from '../../platform/afterInteractions';
import type {SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {StorageService} from '../../platform/storage';
import {swipeActionsPreference} from '../../platform/swipeActions';
import {usePreference} from './usePreference';

const SWIPE_TUTORIAL_KEY_PREFIX = 'swipe_tutorial_seen_';

type TutorialScreen = 'home' | 'category' | 'debt';

interface UseSwipeTutorialOptions {
  screen: TutorialScreen;
  itemCount: number;
}

interface UseSwipeTutorialReturn {
  shouldShowTutorial: boolean;
  tutorialRef: React.RefObject<SwipeableMethods | null>;
  dismissTutorial: () => void;
}

export const useSwipeTutorial = ({screen, itemCount}: UseSwipeTutorialOptions): UseSwipeTutorialReturn => {
  const storageKey = SWIPE_TUTORIAL_KEY_PREFIX + screen;
  // Once per screen, not on every render of it (an MMKV read each time Home redrew).
  const alreadySeen = useMemo(() => StorageService.getBoolean(storageKey), [storageKey]);
  const swipeEnabled = usePreference(swipeActionsPreference);
  const [active, setActive] = useState(false);
  const tutorialRef = useRef<SwipeableMethods | null>(null);
  const hasTriggeredRef = useRef(false);

  const dismissTutorial = useCallback(() => {
    setActive(false);
    StorageService.setBoolean(storageKey, true);
    tutorialRef.current?.close();
  }, [storageKey]);

  useEffect(() => {
    if (alreadySeen || !swipeEnabled || hasTriggeredRef.current || itemCount < 1) {
      return;
    }

    hasTriggeredRef.current = true;
    setActive(true);

    // Every timer in the demo chain is tracked so unmount can cancel the whole
    // thing. Cancelling only the InteractionManager task was not enough: once
    // that callback fired, the nested setTimeouts ran to completion ~2.6s
    // later, calling openLeft/close/openRight on a ref belonging to a row the
    // user had already navigated away from.
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let cancelled = false;

    // Re-read the ref at each step rather than closing over it once: the row
    // can be recycled by the list mid-demo.
    const step = (delay: number, run: () => void) => {
      timers.push(
        setTimeout(() => {
          if (cancelled || !tutorialRef.current) {
            return;
          }
          run();
        }, delay),
      );
    };

    const task = afterInteractions(() => {
      if (cancelled) {
        return;
      }
      timers.push(
        setTimeout(() => {
          if (cancelled) {
            return;
          }
          if (!tutorialRef.current) {
            setActive(false);
            StorageService.setBoolean(storageKey, true);
            return;
          }

          tutorialRef.current.openLeft();
          step(800, () => tutorialRef.current?.close());
          step(1200, () => tutorialRef.current?.openRight());
          step(2000, () => tutorialRef.current?.close());
        }, 600),
      );
    });

    return () => {
      cancelled = true;
      task.cancel();
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [alreadySeen, swipeEnabled, itemCount, storageKey]);

  return {
    shouldShowTutorial: active && !alreadySeen && swipeEnabled,
    tutorialRef,
    dismissTutorial,
  };
};
