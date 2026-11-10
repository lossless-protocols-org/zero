/**
 * "Get Started" deletes whatever the database holds. The keep-or-delete prompt
 * only ran when a user row and transactions both existed, so transactions with
 * no user row (or debts and budgets with no transactions) went in one tap with
 * nothing on screen. Anything the user entered must be confirmed first.
 */
import {act, renderHook} from '@testing-library/react-native';
import {useWelcome} from '../../../../../../src/features/onboarding/screens/WelcomeScreen/useWelcome';

const mockCounts = {
  users: 0,
  expenses: 0,
  categories: 0,
  debts: 0,
  debtors: 0,
  budgets: 0,
  currencies: 0,
  accounts: 0,
  refunds: 0,
  incomes: 0,
  total: 0,
};
const mockDeleteAllData = jest.fn(() => Promise.resolve());
const mockShowDialog = jest.fn((_opts: {message: string}) => Promise.resolve(false));
const mockNavigate = jest.fn();

jest.mock('../../../../../../src/data/services/deleteService', () => ({
  countAllRecords: () => Promise.resolve(mockCounts),
  deleteAllData: () => mockDeleteAllData(),
}));
jest.mock('../../../../../../src/ui/context/DialogContext', () => ({
  useDialog: () => ({showDialog: mockShowDialog, showAlert: jest.fn(() => Promise.resolve())}),
}));
jest.mock('../../../../../../src/platform/navigationUtils', () => ({navigate: (name: string) => mockNavigate(name)}));
jest.mock('../../../../../../src/store/hooks', () => ({useAppDispatch: () => jest.fn()}));
jest.mock('../../../../../../src/ui/hooks/useThemeColors', () => ({useThemeColors: () => ({})}));
jest.mock('react-i18next', () => require('../../../../../harness/mocks/reactI18next'));

const setCounts = (c: Partial<typeof mockCounts>) => {
  Object.assign(
    mockCounts,
    {
      users: 0,
      expenses: 0,
      categories: 0,
      debts: 0,
      debtors: 0,
      budgets: 0,
      currencies: 0,
      accounts: 0,
      refunds: 0,
      incomes: 0,
    },
    c,
  );
  const {users, expenses, categories, debts, debtors, budgets, currencies} = mockCounts;
  mockCounts.total = users + expenses + categories + debts + debtors + budgets + currencies;
};

const pressGetStarted = async () => {
  const {result} = await renderHook(() => useWelcome());
  await act(() => result.current.handleNewUser());
};

beforeEach(() => {
  mockDeleteAllData.mockClear();
  mockShowDialog.mockClear();
  mockNavigate.mockClear();
  mockShowDialog.mockImplementation(() => Promise.resolve(false));
});

describe('Get Started on a device that already holds records', () => {
  it('asks before deleting transactions that have no user row, and deletes nothing on cancel', async () => {
    setCounts({expenses: 5, categories: 8});
    await pressGetStarted();
    expect(mockShowDialog).toHaveBeenCalledTimes(1);
    expect(mockShowDialog.mock.calls[0]?.[0].message).toBe('welcome.deleteOrphanedConfirm');
    expect(mockDeleteAllData).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('deletes and continues once the orphaned records are confirmed', async () => {
    setCounts({expenses: 5, categories: 8});
    mockShowDialog.mockImplementation(() => Promise.resolve(true));
    await pressGetStarted();
    expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('PersonalizeScreen');
  });

  it('offers to keep debts or budgets that belong to a profile, even with no transactions', async () => {
    setCounts({users: 1, categories: 8, debts: 2});
    mockShowDialog.mockImplementationOnce(() => Promise.resolve(true));
    await pressGetStarted();
    expect(mockShowDialog.mock.calls[0]?.[0].message).toBe('welcome.existingRecordsPrompt');
    expect(mockDeleteAllData).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('asks before deleting people added as debtors, even with no debts', async () => {
    setCounts({users: 1, categories: 8, debtors: 2});
    await pressGetStarted();
    expect(mockShowDialog).toHaveBeenCalledTimes(2);
    expect(mockDeleteAllData).not.toHaveBeenCalled();
  });

  it('clears a leftover currency row rather than onboarding next to it', async () => {
    setCounts({currencies: 1});
    await pressGetStarted();
    expect(mockShowDialog).not.toHaveBeenCalled();
    expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
  });

  it('still clears a profile with only seeded categories without asking', async () => {
    setCounts({users: 1, categories: 8});
    await pressGetStarted();
    expect(mockShowDialog).not.toHaveBeenCalled();
    expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('PersonalizeScreen');
  });
});
