# Tests

Every test lives here, in one tree sorted by kind. Nothing test-related lives under `src/`.

This was the owner's decision on 2026-11-08, recorded in the audit (`references/audit/2026-11-08-principal-engineer-audit.md`, §7.2 and §12.2).

## Where a test goes

| Folder         | What goes there                                                                                                                                                                                                          | Runner                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `unit/`        | One module. The path mirrors `src/`, so `unit/domain/money.test.ts` tests `src/domain/money.ts`.                                                                                                                         | jest                  |
| `component/`   | Something that renders UI (an atom, a molecule, a feature component). The path mirrors `src/`.                                                                                                                           | jest + RNTL           |
| `integration/` | Two or more layers working together, such as a restore end to end, the store over services, or a thunk shown in a banner.                                                                                                | jest                  |
| `contract/`    | Fixtures and cross-language pins: old backups, the widget snapshot contract, the money-format cases. The Kotlin and Swift tests read the same files from `/contracts`.                                                   | jest                  |
| `arch/`        | Rules about the code itself: layers, unused code, no whole-table reads, refunds read in one place, every touchable named for screen readers, no sentence assembled around a translation, and this tree mirroring `src/`. | jest                  |
| `scripts/`     | The repo's own scripts (`scripts/*.mjs`), run on fixtures.                                                                                                                                                               | jest                  |
| `sqlite/`      | SQL that LokiJS cannot run (query plans, migrations, `unsafeSqlQuery`), run on bun's built-in SQLite.                                                                                                                    | `bun run test:sqlite` |
| `app/`         | The whole app mounted (`App.tsx`).                                                                                                                                                                                       | jest                  |
| `e2e/`         | Maestro flows on a device or emulator, run by hand and in the weekly CI job.                                                                                                                                             | maestro               |
| `harness/`     | Shared helpers and mocks. These are not tests: jest only collects `*.test.*` files.                                                                                                                                      | —                     |

## Rules

1. **A unit or component test mirrors its module.**
   - Name it `<module>.test.ts(x)`, or `<module>.<aspect>.test.ts(x)` when one module has several suites (`budgetMath.resolve.test.ts`).
   - When you move or rename a module, move its test in the same commit.
   - `arch/testTargets.test.ts` fails on a test whose module is gone.
   - The same test keeps a ratchet: the number of modules with logic and no test of their own may only go down.
2. **Mock at the edges, not your own code.**
   - Unit and integration tests use the real store, services and schema, on the in-memory LokiJS database that `jest.setup.js` installs for every suite. Seed it through `harness/services`.
   - Mock only what cannot run under jest:
     - native modules;
     - the navigator (`navigationUtils`, `harness/mocks/focusEffect`);
     - SQL that LokiJS cannot run;
     - copy, when you assert on keys (`harness/mocks/reactI18next`).
   - A test that mocks the module it is about is testing its call graph, not its behaviour.
3. **Render with Testing Library.**
   - Use `@testing-library/react-native` (`render`, `renderHook`, `screen`, `fireEvent`), not `react-test-renderer`, which React has deprecated.
   - Query the way a user or a screen reader finds things: by role, label or text.
   - `harness/render` mounts inside the app's real providers:
     - `renderWithTheme` gives the real palette, so you never hand-write colours;
     - `renderInApp` and `renderHookInApp` give the real store, theme, dialogs and gesture root.
   - Two things `fireEvent` cannot do go through `harness/handlers.handlerOf`: a native gesture, and two taps before React re-renders.
4. **Names say what happens.**
   - `describe` and `it` read as behaviour: "keeps the stored placeholder when its translation is saved back unchanged".
   - Ticket ids (`M19`, `R2`, `audit 2026-11-08 §3.4`) go in the file's header comment, not in test names.
5. **The same data on every run.**
   - Seeds come from `harness/seed`, which anchors `scripts/seed-backup.mjs` to a fixed day and caches the file.
   - Time-dependent tests fix "now" with `jest.useFakeTimers({now, advanceTimers: true})`.
6. **Paths come from `harness/paths`** (`fromRoot(...)`), never `${__dirname}/../..`.
7. **Cost is counted, not timed.** With JSI every database call blocks the JS thread, and a CI machine's timings say nothing about a phone. A test that guards a hot path counts:
   - reads, with `harness/readCount.countReads` (each read is named by table and filtered columns: `unsafeQueryRaw expenses(user_id,date)`), as `integration/readBudgets.test.ts` does;
   - re-renders, by counting a child component's renders across a `rerender`, as `component/features/spending/components/TransactionList.renders.test.tsx` does.

## Commands

| Command                 | What it runs                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bun run test`          | Every jest suite.                                                                                                      |
| `bun run test:coverage` | Every jest suite against the coverage ratchet in `jest.config.js`. Raise an entry when you add tests; never lower one. |
| `bun run test:sqlite`   | `sqlite/` on bun.                                                                                                      |
| `bun run test:android`  | The Kotlin tests.                                                                                                      |
| `bun run test:ios`      | The `ZeroShared` Swift package tests.                                                                                  |
| `bun run test:e2e`      | The Maestro flows on a connected device (`e2e/README.md`).                                                             |
| `bun run check`         | The whole gate CI runs.                                                                                                |
