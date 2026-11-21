/**
 * The app's dialogs for suites about what a hook or component says and asks:
 * an alert is recorded and dismissed at once; a confirm is recorded and
 * answered with what the suite set (yes unless told otherwise).
 *
 *   jest.mock('<…>/src/ui/context/DialogContext', () => require('<…>/harness/mocks/dialogs').dialogContextMock());
 */
interface Said {
  type?: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
}

const said: Said[] = [];
let nextAnswer = true;

/** Every alert and confirm shown so far, as "type: message". */
export const dialogsSaid = (): string[] => said.map(({type, message}) => `${type ?? 'info'}: ${message}`);

/** How the next confirm is answered. */
export const answerNextDialog = (confirmed: boolean): void => {
  nextAnswer = confirmed;
};

export const resetDialogs = (): void => {
  said.length = 0;
  nextAnswer = true;
};

const showAlert = async (config: Said): Promise<void> => {
  said.push(config);
};
const showDialog = async (config: Said): Promise<boolean> => {
  said.push(config);
  const answer = nextAnswer;
  nextAnswer = true;
  return answer;
};

/** The module as the app uses it: a provider that only passes its children through, and the hook. */
export const dialogContextMock = () => ({
  useDialog: () => ({showAlert, showDialog}),
  DialogProvider: ({children}: {children: unknown}) => children,
});
