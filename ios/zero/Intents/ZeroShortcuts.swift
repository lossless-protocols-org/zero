import AppIntents

/// Siri phrases, Spotlight and the Action Button (2.8). Phrases must name the
/// app; one may name a category too ("Add a Food expense in zero"), from the
/// categories the snapshot lists (`updateAppShortcutParameters()` runs when
/// they change, ZeroWidgetStore). The intents themselves live in ZeroShared.
/// 17.4: the first release whose builder takes `#available` (iOS 26 snippet).
@available(iOS 17.4, *)
struct ZeroShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddExpenseIntent(),
      phrases: [
        "Add an expense in \(.applicationName)",
        "Add expense to \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "Add a \(\.$category) expense in \(.applicationName)",
        "Add \(\.$category) to \(.applicationName)",
      ],
      shortTitle: "intents_add_expense",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: AddMoneyInIntent(),
      phrases: [
        "Add money in to \(.applicationName)",
        "Log money in in \(.applicationName)",
      ],
      shortTitle: "intents_add_income",
      systemImageName: "arrow.down.circle"
    )
    AppShortcut(
      intent: RepeatLastExpenseIntent(),
      phrases: [
        "Repeat my last expense in \(.applicationName)",
        "Same again in \(.applicationName)",
      ],
      shortTitle: "intents_repeat_last",
      systemImageName: "arrow.clockwise.circle"
    )
    AppShortcut(
      intent: SpendingIntent(),
      phrases: [
        "How much have I spent in \(.applicationName)",
        "What did I spend this month in \(.applicationName)",
      ],
      shortTitle: "intents_spending",
      systemImageName: "chart.bar"
    )
    AppShortcut(
      intent: UndoLastEntryIntent(),
      phrases: [
        "Undo my last entry in \(.applicationName)",
        "Undo in \(.applicationName)",
      ],
      shortTitle: "intents_undo_last",
      systemImageName: "arrow.uturn.backward.circle"
    )
    if #available(iOS 26.0, *) {
      AppShortcut(
        intent: AgainMenuIntent(),
        phrases: [
          "Add again in \(.applicationName)",
          "Quick add in \(.applicationName)",
        ],
        shortTitle: "intents_again",
        systemImageName: "plus.square.on.square"
      )
    }
  }
}
