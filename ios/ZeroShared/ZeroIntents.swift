import AppIntents
import Foundation
import WidgetKit

// Adding to zero without opening it (2.8). Compiled into the app AND the
// widget extension: Siri, Spotlight, Shortcuts and the Action Button run these
// in zero's process; the widget's buttons and the Control Center controls run
// them in the extension. Neither can reach zero's database, which only its
// JavaScript writes: an entry is queued in the App Group and the widget
// redrawn with it at once; the app saves it through its normal services the
// next time it runs (src/widgets/pendingEntries.ts). Until then it can be
// taken back (Undo).

/// A category Siri and Shortcuts offer, from the widget snapshot.
@available(iOS 17.0, *)
struct ZeroCategoryEntity: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "intents_category")
  static let defaultQuery = ZeroCategoryQuery()

  var id: String
  var name: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

/// Every active expense category, most used first (the snapshot's order).
@available(iOS 17.0, *)
struct ZeroCategoryQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ZeroCategoryEntity] {
    all().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [ZeroCategoryEntity] { all() }

  /// What Siri heard ("food", "the food one"). Without this a plain EntityQuery cannot resolve a spoken
  /// name, so Siri asked "Which category?" and then, after the answer, "Which one?" with the list again
  /// (owner report, 2.8 on the iPhone). One exact name wins; else names the words start or contain.
  func entities(matching string: String) async throws -> [ZeroCategoryEntity] {
    Self.match(string, in: all())
  }

  /// The categories `said` names, best first: one exact name (any case) wins
  /// outright; else the names the words start with (or that start the words);
  /// else names contained in the words or containing them. Nothing said: all.
  static func match(_ said: String, in rows: [ZeroCategoryEntity]) -> [ZeroCategoryEntity] {
    let words = said.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !words.isEmpty else { return rows }
    let named = { (row: ZeroCategoryEntity) in row.name.lowercased() }
    if let exact = rows.first(where: { named($0) == words }) { return [exact] }
    let starts = rows.filter { named($0).hasPrefix(words) || words.hasPrefix(named($0)) }
    if !starts.isEmpty { return starts }
    return rows.filter { words.contains(named($0)) || named($0).contains(words) }
  }

  private func all() -> [ZeroCategoryEntity] {
    (SharedStore.snapshot()?.categories ?? []).map { ZeroCategoryEntity(id: $0.id, name: $0.name) }
  }
}

@available(iOS 17.0, *)
enum ZeroIntentError: Error, CustomLocalizedStringResourceConvertible {
  case notReady
  case badAmount
  case nothingToRepeat
  case nothingToUndo

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .notReady: return "intents_not_ready"
    case .badAmount: return "intents_bad_amount"
    case .nothingToRepeat: return "intents_nothing_to_repeat"
    case .nothingToUndo: return "intents_nothing_to_undo"
    }
  }
}

/// Queues entries and words what happened, for every intent below.
@available(iOS 17.0, *)
enum ZeroEntries {
  /// zero's ceiling for an amount: the same 10^11 major units as createAmountSchema's MAX_MAJOR_UNITS
  /// (lower per currency there; the app re-checks every queued entry before saving).
  static let maxAmount = 1e11

  /// Queues an entry; returns what the user is told ("₹120 added to Food").
  @discardableResult
  static func add(_ kind: PendingEntry.Kind, amount: Double, categoryId: String, title: String) throws -> String {
    guard let snapshot = SharedStore.snapshot(), snapshot.ready else { throw ZeroIntentError.notReady }
    guard amount.isFinite, amount > 0, amount <= maxAmount else { throw ZeroIntentError.badAmount }
    let money = format(amount, snapshot)
    let categoryName = snapshot.categories?.first(where: { $0.id == categoryId })?.name ?? ""
    let name = kind == .income ? snapshot.labels.addIncome : (title.isEmpty ? categoryName : title)
    // With amounts hidden the widget never shows an amount, not even this one.
    let label = snapshot.live == nil ? name : WidgetSnapshot.fill(String(localized: "intents_entry_label"), [money, name])
    SharedStore.enqueue(
      PendingEntry(
        id: UUID().uuidString.lowercased(), kind: kind, amount: amount, categoryId: categoryId, title: title,
        date: PendingEntry.localDateTime(Date())),
      label: label)
    WidgetCenter.shared.reloadAllTimelines()
    return kind == .income
      ? WidgetSnapshot.fill(String(localized: "quickadd_added_income"), [money])
      : WidgetSnapshot.fill(String(localized: "quickadd_added"), [money, categoryName])
  }

  /// Takes back the last entry made outside the app; returns what the user is told.
  static func undoLast() throws -> String {
    guard let last = SharedStore.lastUndoable(), SharedStore.undo(id: last.id) != nil else {
      throw ZeroIntentError.nothingToUndo
    }
    WidgetCenter.shared.reloadAllTimelines()
    return WidgetSnapshot.fill(String(localized: "intents_undone"), [last.label])
  }

  /// The amount as the app writes it ("₹120"), or plainly before there are rules.
  static func format(_ amount: Double, _ snapshot: WidgetSnapshot) -> String {
    snapshot.money?.format(.shortest(amount))
      ?? NumberFormatter.localizedString(from: NSNumber(value: amount), number: .decimal)
  }
}

// MARK: - Siri, Spotlight, Shortcuts, the Action Button, controls

@available(iOS 17.0, *)
struct AddExpenseIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_add_expense"
  static let description = IntentDescription("intents_add_expense_description")

  @Parameter(title: "intents_amount", requestValueDialog: IntentDialog("intents_amount_prompt"))
  var amount: Double

  @Parameter(title: "intents_category", requestValueDialog: IntentDialog("intents_category_prompt"))
  var category: ZeroCategoryEntity

  @Parameter(title: "intents_what_for")
  var whatFor: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$amount) to \(\.$category)") {
      \.$whatFor
    }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let said = try ZeroEntries.add(.expense, amount: amount, categoryId: category.id, title: whatFor ?? "")
    return .result(dialog: IntentDialog(stringLiteral: said))
  }
}

@available(iOS 17.0, *)
struct AddMoneyInIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_add_income"
  static let description = IntentDescription("intents_add_income_description")

  @Parameter(title: "intents_amount", requestValueDialog: IntentDialog("intents_amount_prompt"))
  var amount: Double

  @Parameter(title: "intents_note")
  var note: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$amount) money in") {
      \.$note
    }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    // Free has one income category; before it exists the app creates it when saving.
    let categoryId = SharedStore.snapshot()?.incomeCategoryId ?? ""
    let said = try ZeroEntries.add(.income, amount: amount, categoryId: categoryId, title: note ?? "")
    return .result(dialog: IntentDialog(stringLiteral: said))
  }
}

@available(iOS 17.0, *)
struct RepeatLastExpenseIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_repeat_last"
  static let description = IntentDescription("intents_repeat_last_description")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let last = SharedStore.snapshot()?.last else { throw ZeroIntentError.nothingToRepeat }
    let said = try ZeroEntries.add(
      .expense, amount: last.amount, categoryId: last.categoryId,
      title: last.title == last.categoryName ? "" : last.title)
    return .result(dialog: IntentDialog(stringLiteral: said))
  }
}

@available(iOS 17.0, *)
struct UndoLastEntryIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_undo_last"
  static let description = IntentDescription("intents_undo_last_description")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    .result(dialog: IntentDialog(stringLiteral: try ZeroEntries.undoLast()))
  }
}

/// "How much have I spent": answered in place, with the figures as a card.
@available(iOS 17.0, *)
struct SpendingIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_spending"
  static let description = IntentDescription("intents_spending_description")

  func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
    guard let snapshot = SharedStore.snapshot()?.asOf(Date()), snapshot.ready else {
      throw ZeroIntentError.notReady
    }
    return .result(dialog: IntentDialog(stringLiteral: snapshot.spokenSummary), view: SpendingCard(s: snapshot))
  }
}

// MARK: - Widget and snippet buttons (not offered to Siri or Shortcuts)

/// Adds an "add again" entry once more.
@available(iOS 17.0, *)
struct AddAgainIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_again"
  static let isDiscoverable = false

  @Parameter(title: "intents_what_for") var title: String
  @Parameter(title: "intents_amount") var amount: Double
  @Parameter(title: "intents_category") var categoryId: String

  init() {}

  init(_ again: WidgetSnapshot.Again) {
    // The title only when it is its own: a blank one is saved as the category's name by the app.
    title = again.title == again.categoryName ? "" : again.title
    amount = again.amount
    categoryId = again.categoryId
  }

  func perform() async throws -> some IntentResult {
    try ZeroEntries.add(.expense, amount: amount, categoryId: categoryId, title: title)
    return .result()
  }
}

/// Takes back one entry made outside the app, while it is still waiting.
@available(iOS 17.0, *)
struct UndoEntryIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_undo"
  static let isDiscoverable = false

  @Parameter(title: "intents_undo") var id: String

  init() {}
  init(id: String) { self.id = id }

  /// Says so when there was nothing to take back (the app saved the entry in
  /// the meantime: it is changed in zero now), as Undo last does; this used to
  /// return as if it had worked (audit 2026-11-08 App. B).
  func perform() async throws -> some IntentResult {
    guard SharedStore.undo(id: id) != nil else { throw ZeroIntentError.nothingToUndo }
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

/// One key of the widget keypad ("0"–"9", ".", "back").
@available(iOS 17.0, *)
struct KeypadKeyIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_keypad_name"
  static let isDiscoverable = false

  @Parameter(title: "intents_amount") var key: String

  init() {}
  init(_ key: String) { self.key = key }

  func perform() async throws -> some IntentResult {
    SharedStore.press(key, maxDecimals: SharedStore.snapshot()?.money?.maxDecimals ?? 2)
    return .result()
  }
}

/// The widget keypad's category (or money in) button: adds the typed amount.
@available(iOS 17.0, *)
struct KeypadSaveIntent: AppIntent {
  static let title: LocalizedStringResource = "intents_add_expense"
  static let isDiscoverable = false

  @Parameter(title: "intents_category") var categoryId: String
  @Parameter(title: "intents_category") var income: Bool

  init() {}
  init(categoryId: String, income: Bool = false) {
    self.categoryId = categoryId
    self.income = income
  }

  func perform() async throws -> some IntentResult {
    guard let amount = KeypadState.amount(SharedStore.keypadText()) else { return .result() }
    try ZeroEntries.add(
      income ? .income : .expense, amount: NSDecimalNumber(decimal: amount).doubleValue,
      categoryId: categoryId, title: "")
    SharedStore.clearKeypad()
    return .result()
  }
}
