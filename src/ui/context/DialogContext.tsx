import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import type {IconName} from '../atoms/IconRegistry';

export type DialogType = 'success' | 'warning' | 'error' | 'info';

/**
 * One line of a structured list inside a dialog.
 *
 * Long explanatory dialogs used to pass their bullets inside `message` as
 * "\n• ..." text. That renders centred (the message is centre-aligned under
 * the icon), so every line wrapped to a different width with no left edge to
 * read down and no space between points — unreadable for anything longer than
 * a sentence. Bullets are structured instead: left-aligned, evenly spaced, and
 * each with an icon that carries meaning on its own.
 */
interface DialogBullet {
  /** Icon registry name, e.g. 'share-2'. */
  icon: IconName;
  text: string;
}

interface DialogConfig {
  type?: DialogType;
  message: string;
  bullets?: DialogBullet[];
  okLabel?: string;
  cancelLabel?: string;
}

interface DialogContextType {
  showDialog: (config: DialogConfig) => Promise<boolean>;
  showAlert: (config: Omit<DialogConfig, 'cancelLabel'>) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface InternalDialog extends DialogConfig {
  resolve: (value: boolean) => void;
  reject: (reason: Error) => void;
  showCancel: boolean;
}

/** Fade-out time of the Modal before the next queued dialog is presented. */
const DISMISS_DELAY_MS = 400;

/**
 * Rejection for dialogs still open when the provider unmounts (the app is
 * tearing down, or an ErrorBoundary replaced the tree). Tagged so the error
 * log records it as a consequence, never as the unhandled cause (M5).
 * platform/errorLog sits below ui, so it matches the `name`, not the class.
 * @internal test
 */
export class DialogUnmountedError extends Error {
  constructor() {
    super('Dialog provider unmounted');
    this.name = 'DialogUnmountedError';
  }
}

/** What the dialog view draws; the provider owns the queue and the promises. */
export interface DialogViewProps {
  visible: boolean;
  dialog: (DialogConfig & {showCancel: boolean}) | null;
  /** true = OK, false = Cancel, backdrop or Android back. */
  onClose: (confirmed: boolean) => void;
}

interface DialogProviderProps {
  children: ReactNode;
  /**
   * Draws the dialog. Passed in (App passes components/molecules/DialogView)
   * so this context does not import UI components (M9).
   */
  DialogView: React.ComponentType<DialogViewProps>;
}

export const DialogProvider: React.FC<DialogProviderProps> = ({children, DialogView}) => {
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState<InternalDialog | null>(null);
  const activeRef = useRef<InternalDialog | null>(null);
  const queueRef = useRef<InternalDialog[]>([]);
  const dismissingRef = useRef(false);
  const showNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const present = useCallback((dialog: InternalDialog) => {
    activeRef.current = dialog;
    setDisplay(dialog);
    setVisible(true);
  }, []);

  const showNext = useCallback(() => {
    showNextTimerRef.current = null;
    dismissingRef.current = false;
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (next) {
        present(next);
        return;
      }
    }
    activeRef.current = null;
  }, [present]);

  // Idempotent (M5, v2.7.1): a second tap during the fade used to schedule
  // showNext twice, and with a dialog queued the second call cleared
  // activeRef under the dialog it had just presented — its OK then resolved
  // nothing and the caller's `await showDialog()` never resumed.
  const dismiss = useCallback(
    (result: boolean) => {
      const active = activeRef.current;
      if (!active) {
        return;
      }
      active.resolve(result);
      activeRef.current = null;
      dismissingRef.current = true;
      setVisible(false);
      showNextTimerRef.current = setTimeout(showNext, DISMISS_DELAY_MS);
    },
    [showNext],
  );

  // A dialog still open (or queued) when the provider goes away would leave
  // its caller awaiting forever; reject instead so the caller's error path runs.
  useEffect(
    () => () => {
      if (showNextTimerRef.current) {
        clearTimeout(showNextTimerRef.current);
      }
      // Full reset, so a remount of this instance (Fast Refresh) starts clean.
      showNextTimerRef.current = null;
      dismissingRef.current = false;
      const pending = [activeRef.current, ...queueRef.current];
      activeRef.current = null;
      queueRef.current = [];
      for (const dialog of pending) {
        dialog?.reject(new DialogUnmountedError());
      }
    },
    [],
  );

  const enqueue = useCallback(
    (dialog: InternalDialog) => {
      if (activeRef.current || dismissingRef.current) {
        queueRef.current.push(dialog);
      } else {
        present(dialog);
      }
    },
    [present],
  );

  const showDialog = useCallback(
    (config: DialogConfig): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        enqueue({...config, resolve, reject, showCancel: true});
      });
    },
    [enqueue],
  );

  const showAlert = useCallback(
    (config: Omit<DialogConfig, 'cancelLabel'>): Promise<void> => {
      return new Promise((resolve, reject) => {
        enqueue({
          ...config,
          resolve: () => resolve(),
          reject,
          showCancel: false,
        });
      });
    },
    [enqueue],
  );

  const contextValue = useMemo(() => ({showDialog, showAlert}), [showDialog, showAlert]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <DialogView visible={visible} dialog={display} onClose={dismiss} />
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
