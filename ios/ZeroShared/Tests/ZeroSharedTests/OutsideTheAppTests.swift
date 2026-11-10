import XCTest

@testable import ZeroShared

/// Entries made while zero is closed (Siri, Shortcuts, the widget's buttons):
/// the widget shows them at once, the queue keeps them until the app saves
/// them, Undo takes them back. This is the Swift that changes money figures.
final class ApplyingEntriesTests: XCTestCase {
  private let now = Fixtures.at(2026, 11, 6, 18)

  private func ready() throws -> WidgetSnapshot {
    try XCTUnwrap(WidgetSnapshot.parse(try Fixtures.contract("ready")))
  }

  private func entry(_ id: String, _ kind: PendingEntry.Kind, _ amount: Double, on date: String = "2026-11-06T18:00:00")
    -> PendingEntry
  {
    PendingEntry(id: id, kind: kind, amount: amount, categoryId: "cat_food", title: "", date: date)
  }

  func testAnExpenseTodayAddsToTodayAndTheMonthAndRewritesTheText() throws {
    let s = try ready().applying(entry("e1", .expense, 250), sign: 1, now: now, Fixtures.calendar)
    XCTAssertEqual(s.live?.spentMonth, 45279)
    XCTAssertEqual(s.live?.spentToday, 370)
    XCTAssertEqual(s.spentMonth, "₹45,279")
    XCTAssertEqual(s.spentToday, "₹370")
    XCTAssertEqual(s.budget?.text, "₹15,279 over budget")
    XCTAssertEqual(s.labels.summary, "November: ₹45,279 spent. Today: ₹370.")
  }

  /// Decimal(Double) keeps 33.33 as 33.32999999999999488 and 0.07 as 0.07000000000000001024;
  /// three of each must still add to exactly 100.20 (audit §3.8).
  func testRepeatedAmountsAddExactly() throws {
    var s = try ready()
    for i in 0..<3 {
      s = s.applying(entry("a\(i)", .expense, 33.33), sign: 1, now: now, Fixtures.calendar)
      s = s.applying(entry("b\(i)", .expense, 0.07), sign: 1, now: now, Fixtures.calendar)
    }
    XCTAssertEqual(s.live?.spentMonth, Decimal(string: "45129.2"))
    XCTAssertEqual(s.live?.spentToday, Decimal(string: "220.2"))
    XCTAssertEqual(s.spentMonth, "₹45,129.20")
  }

  func testMoneyInChangesReceivedAndKeptOnly() throws {
    let s = try ready().applying(entry("i1", .income, 5000), sign: 1, now: now, Fixtures.calendar)
    XCTAssertEqual(s.live?.received, 85000)
    XCTAssertEqual(s.live?.spentMonth, 45029)
    XCTAssertEqual(s.incomeLine, "Received ₹85,000 · Kept ₹39,971")
  }

  func testAnEntryDatedInAnotherMonthLeavesTheFiguresAlone() throws {
    let s = try ready().applying(entry("e1", .expense, 99, on: "2026-10-31T10:00:00"), sign: 1, now: now, Fixtures.calendar)
    XCTAssertEqual(s.live?.spentMonth, 45029)
  }

  func testUndoRestoresEveryFigure() throws {
    let start = try ready()
    let added = start.applying(entry("e1", .expense, 250), sign: 1, now: now, Fixtures.calendar)
    let undone = added.applying(entry("e1", .expense, 250), sign: -1, now: now, Fixtures.calendar)
    XCTAssertEqual(undone.live, start.live)
    XCTAssertEqual(undone.spentMonth, start.spentMonth)
    XCTAssertEqual(undone.budget, start.budget)
  }

  func testWithAmountsHiddenNothingChanges() throws {
    let hidden = try XCTUnwrap(WidgetSnapshot.parse(try Fixtures.contract("hidden")))
    XCTAssertEqual(hidden.applying(entry("e1", .expense, 250), sign: 1, now: now, Fixtures.calendar), hidden)
  }
}

/// The App Group store: the queue, its figures re-applied over the app's own
/// snapshot until saved, and Undo. Runs on the test runner's defaults (no group
/// container here, so the lock is not exercised, only the bookkeeping).
final class SharedStoreTests: XCTestCase {
  private let now = Fixtures.at(2026, 11, 6, 18)

  override func setUp() {
    super.setUp()
    UserDefaults(suiteName: SharedStore.groupID)?.removePersistentDomain(forName: SharedStore.groupID)
  }

  private func entry(_ id: String, _ amount: Double) -> PendingEntry {
    PendingEntry(id: id, kind: .expense, amount: amount, categoryId: "cat_food", title: "Tea", date: "2026-11-06T18:00:00")
  }

  func testAQueuedEntryShowsAtOnceAndSurvivesTheAppsNextWrite() throws {
    let app = try Fixtures.contract("ready")
    XCTAssertTrue(SharedStore.writeSnapshot(app, now: now))
    SharedStore.enqueue(entry("q1", 20), label: "₹20 · Food", now: now)
    XCTAssertEqual(SharedStore.snapshot()?.live?.spentMonth, 45049)
    // The app writes its figures again before it has saved q1: q1 is still added.
    SharedStore.writeSnapshot(app, now: now)
    XCTAssertEqual(SharedStore.snapshot()?.live?.spentMonth, 45049)
    XCTAssertEqual(SharedStore.lastAdded(now: now)?.id, "q1")
  }

  func testOnceSavedAndRemovedItIsNoLongerAdded() throws {
    let app = try Fixtures.contract("ready")
    SharedStore.writeSnapshot(app, now: now)
    SharedStore.enqueue(entry("q1", 20), label: "₹20 · Food", now: now)
    SharedStore.removePending(ids: ["q1"])
    SharedStore.writeSnapshot(app, now: now)
    XCTAssertEqual(SharedStore.snapshot()?.live?.spentMonth, 45029)
    XCTAssertTrue(SharedStore.pendingEntries().isEmpty)
    XCTAssertNil(SharedStore.lastAdded(now: now))
  }

  func testUndoTakesItOffTheQueueAndOutOfTheFigures() throws {
    SharedStore.writeSnapshot(try Fixtures.contract("ready"), now: now)
    SharedStore.enqueue(entry("q1", 20), label: "₹20 · Food", now: now)
    XCTAssertEqual(SharedStore.undo(id: "q1", now: now)?.id, "q1")
    XCTAssertEqual(SharedStore.snapshot()?.live?.spentMonth, 45029)
    XCTAssertNil(SharedStore.undo(id: "q1", now: now))  // already gone: nothing to take back
  }

  func testRewritingTheSameFiguresIsNotAChange() throws {
    let app = try Fixtures.contract("ready")
    XCTAssertTrue(SharedStore.writeSnapshot(app, now: now))
    let later = try Fixtures.contract("ready") { $0["computedAt"] = 1 }
    XCTAssertFalse(SharedStore.writeSnapshot(later, now: now))
  }

  func testUndoIsOfferedOnlyWhileFresh() throws {
    SharedStore.writeSnapshot(try Fixtures.contract("ready"), now: now)
    SharedStore.enqueue(entry("q1", 20), label: "₹20 · Food", now: now)
    XCTAssertNotNil(SharedStore.lastAdded(now: now.addingTimeInterval(SharedStore.undoLifetime - 1)))
    XCTAssertNil(SharedStore.lastAdded(now: now.addingTimeInterval(SharedStore.undoLifetime + 1)))
    XCTAssertEqual(SharedStore.lastUndoable()?.id, "q1")  // by voice, however old
  }
}

/// The widget keypad's typing rules.
final class KeypadTests: XCTestCase {
  private func type(_ keys: [String], decimals: Int = 2) -> String {
    keys.reduce("") { KeypadState.apply($1, to: $0, maxDecimals: decimals) }
  }

  func testTypingRules() {
    XCTAssertEqual(type(["0", "0", "4", "5"]), "45")  // no leading zeros
    XCTAssertEqual(type([".", "5"]), "0.5")
    XCTAssertEqual(type(["1", ".", "2", "3", "4"]), "1.23")  // the currency's decimals
    XCTAssertEqual(type(["1", ".", ".", "2"]), "1.2")  // one point
    XCTAssertEqual(type(["1", ".", "2"], decimals: 0), "12")  // no point without decimals
    XCTAssertEqual(type(["4", "5", "back"]), "4")
    XCTAssertEqual(type(["4", "5", "clear"]), "")
    XCTAssertEqual(type(Array(repeating: "9", count: 20)).count, KeypadState.maxWholeDigits)
  }

  func testAmounts() {
    XCTAssertEqual(KeypadState.amount("12.5"), Decimal(string: "12.5"))
    XCTAssertNil(KeypadState.amount(""))
    XCTAssertNil(KeypadState.amount("0"))
    XCTAssertNil(KeypadState.amount("0."))
  }
}

/// Siri's category matching (the "asked twice" fix): what was said resolves to
/// one category whenever it can.
final class CategoryMatchTests: XCTestCase {
  private let rows = ["Food", "Fuel", "Transportation", "Rent", "Food court"].enumerated().map {
    ZeroCategoryEntity(id: "c\($0.offset)", name: $0.element)
  }

  private func names(_ said: String) -> [String] { ZeroCategoryQuery.match(said, in: rows).map(\.name) }

  func testAnExactNameInAnyCaseWinsOutright() {
    XCTAssertEqual(names("food"), ["Food"])
    XCTAssertEqual(names("  FUEL "), ["Fuel"])
  }

  func testTheStartOfANameOrANameStartingTheWords() {
    XCTAssertEqual(names("trans"), ["Transportation"])
    XCTAssertEqual(names("rent for november"), ["Rent"])
  }

  func testWordsContainingANameAsALastResort() {
    XCTAssertEqual(names("the fuel one"), ["Fuel"])
  }

  func testNothingSaidOffersEverything() {
    XCTAssertEqual(names(""), rows.map(\.name))
  }
}
