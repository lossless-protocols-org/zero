import XCTest

@testable import ZeroShared

/// The Swift reader against contracts/widget-snapshot-contract.json, the same
/// file the JS builder is pinned to and the Kotlin reader is tested against
/// (WidgetSnapshotTest.kt). Until this, the Swift side was pinned only by a
/// comment (audit 2026-11-08 §6.1). Each Kotlin case has its twin here.
final class WidgetSnapshotContractTests: XCTestCase {
  private func snapshot(_ key: String) throws -> WidgetSnapshot {
    try XCTUnwrap(WidgetSnapshot.parse(try Fixtures.contract(key)), "\(key) did not parse")
  }

  func testReadsEveryFieldTheJSWriterSends() throws {
    let s = try snapshot("ready")
    XCTAssertTrue(s.ready)
    XCTAssertEqual(s.locale, "en-IN")
    XCTAssertEqual(s.monthKey, "2026-11")
    XCTAssertEqual(s.todayKey, "2026-11-06")
    XCTAssertEqual(s.monthLabel, "November")
    XCTAssertEqual(s.spentMonth, "₹45,029")
    XCTAssertEqual(s.spentToday, "₹120")
    XCTAssertEqual(s.zero, "₹0")
    XCTAssertEqual(s.budget, WidgetSnapshot.Budget(progress: 1, over: true, text: "₹15,029 over budget"))
    XCTAssertEqual(s.incomeLine, "Received ₹80,000 · Kept ₹34,971")
    XCTAssertEqual(s.labels.addExpense, "Add expense")
    XCTAssertEqual(s.labels.addIncome, "Money in")
    XCTAssertEqual(s.labels.summary, "November: ₹45,029 spent. Today: ₹120.")
    XCTAssertEqual(s.quick?.map(\.name), ["Food", "Grocery"])
    XCTAssertEqual(s.preview.spentMonth, "₹12,345")
    XCTAssertEqual(s.preview.budgetText, "₹2,655 left")
    XCTAssertEqual(
      s.again, [WidgetSnapshot.Again(title: "Chai", categoryId: "cat_food", categoryName: "Food", amount: 20, amountText: "₹20")])
    XCTAssertEqual(s.live?.spentMonth, 45029)
    XCTAssertEqual(s.live?.budget, 30000)
    XCTAssertEqual(s.money?.grouping, [3, 2])
  }

  func testTheContractVersionIsTheOneThisReaderReads() throws {
    let all = try XCTUnwrap(try JSONSerialization.jsonObject(with: Fixtures.data("widget-snapshot-contract.json")) as? [String: Any])
    for (key, value) in all {
      XCTAssertEqual((value as? [String: Any])?["v"] as? Int, WidgetSnapshot.version, "\(key)")
    }
  }

  /// SharedStore re-encodes a snapshot when it adds queued entries; a field the
  /// JS writes but Swift does not model would vanish from the stored copy.
  func testAReadAndRewriteKeepsEveryFieldButComputedAt() throws {
    let json = try Fixtures.contract("ready")
    let original = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
    let encoded = try XCTUnwrap(try snapshot("ready").encoded())
    let rewritten = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(encoded.utf8)) as? [String: Any])
    XCTAssertEqual(Set(rewritten.keys), Set(original.keys).subtracting(["computedAt"]))
    let live = try XCTUnwrap(rewritten["live"] as? [String: Any])
    XCTAssertEqual(Set(live.keys), Set(try XCTUnwrap(original["live"] as? [String: Any]).keys))
  }

  func testAddAgainIsEmptyWithAmountsHidden() throws {
    XCTAssertEqual(try snapshot("hidden").again ?? [], [])
  }

  func testTheLastExpenseIsReadForRepeatLastAndAbsentWithAmountsHidden() throws {
    XCTAssertEqual(try snapshot("ready").last?.title, "Chai")
    XCTAssertNil(try snapshot("hidden").last)
  }

  func testHiddenAmountsArriveAsDotsWithNoBudgetAndUnderBudgetReadsAsLeft() throws {
    let hidden = try snapshot("hidden")
    XCTAssertEqual(hidden.spentMonth, "••••")
    XCTAssertNil(hidden.budget)
    XCTAssertNil(hidden.live)
    let under = try snapshot("underBudget")
    XCTAssertEqual(under.budget, WidgetSnapshot.Budget(progress: 0.25, over: false, text: "₹22,500 left"))
    XCTAssertNil(under.incomeLine)
    XCTAssertEqual(under.quick ?? [], [])
  }

  func testTheSetupStateReadsAsNotReady() throws {
    XCTAssertFalse(try snapshot("setup").ready)
  }

  /// Both readers bound the bar's fill at parse time (Kotlin's parse does the
  /// same), so a view never draws past the track or before its start.
  func testTheBudgetFillIsBoundedAtParse() throws {
    func progress(_ value: Double) throws -> Double? {
      WidgetSnapshot.parse(try Fixtures.contract("ready") { snapshot in
        var budget = snapshot["budget"] as? [String: Any] ?? [:]
        budget["progress"] = value
        snapshot["budget"] = budget
      })?.budget?.progress
    }
    XCTAssertEqual(try progress(1.7), 1)
    XCTAssertEqual(try progress(-0.2), 0)
    XCTAssertEqual(try progress(0.4), 0.4)
  }

  func testAnUnknownVersionBrokenJSONOrNothingIsNotReadAtAll() throws {
    XCTAssertNil(WidgetSnapshot.parse(try Fixtures.contract("ready") { $0["v"] = 2 }))
    XCTAssertNil(WidgetSnapshot.parse("{not json"))
    XCTAssertNil(WidgetSnapshot.parse(""))
    XCTAssertNil(WidgetSnapshot.parse(nil))
    XCTAssertNil(WidgetSnapshot.parse(try Fixtures.contract("ready") { $0.removeValue(forKey: "labels") }))
  }

  func testASnapshotWrittenBeforeQuickAddHasNoChipsAndNothingElseChanges() throws {
    let old = try XCTUnwrap(WidgetSnapshot.parse(try Fixtures.contract("ready") { $0.removeValue(forKey: "quick") }))
    XCTAssertNil(old.quick)
    XCTAssertEqual(old.spentMonth, "₹45,029")
  }

  func testTheSameDayReadsUnchanged() throws {
    let s = try snapshot("ready")
    XCTAssertEqual(s.asOf(Fixtures.at(2026, 11, 6, 23), Fixtures.calendar), s)
  }

  func testTheNextDayTodayReadsZeroAndTheMonthStays() throws {
    let s = try XCTUnwrap(try snapshot("ready").asOf(Fixtures.at(2026, 11, 7, 0), Fixtures.calendar))
    XCTAssertEqual(s.spentToday, "₹0")
    XCTAssertEqual(s.spentMonth, "₹45,029")
    XCTAssertNotNil(s.budget)
    XCTAssertEqual(s.spokenSummary, "November: ₹45,029. Today: ₹0.")
  }

  func testANewMonthReadsZeroWithItsOwnNameAndNoBudgetOrMoneyIn() throws {
    let s = try XCTUnwrap(try snapshot("ready").asOf(Fixtures.at(2026, 12, 1, 0), Fixtures.calendar))
    XCTAssertEqual(s.monthLabel, "December")
    XCTAssertEqual(s.spentMonth, "₹0")
    XCTAssertEqual(s.spentToday, "₹0")
    XCTAssertNil(s.budget)
    XCTAssertNil(s.incomeLine)
    XCTAssertEqual(s.monthKey, "2026-12")
  }

  func testANewYearRollsTheSameWay() throws {
    let s = try XCTUnwrap(try snapshot("ready").asOf(Fixtures.at(2027, 1, 1, 0), Fixtures.calendar))
    XCTAssertEqual(s.monthLabel, "January")
    XCTAssertEqual(s.monthKey, "2027-01")
  }

  func testAClockMovedBackPastTheSnapshotDayMakesTheFiguresUnknown() throws {
    XCTAssertNil(try snapshot("ready").asOf(Fixtures.at(2026, 11, 5, 23), Fixtures.calendar))
  }

  func testMonthNamesFollowTheSnapshotLanguage() {
    XCTAssertEqual(WidgetSnapshot.monthName(Fixtures.at(2026, 12, 1), languageTag: "fr-FR", Fixtures.calendar), "Décembre")
    XCTAssertEqual(WidgetSnapshot.monthName(Fixtures.at(2026, 12, 1), languageTag: "pt-BR", Fixtures.calendar), "Dezembro")
  }

  // 3.0 (P11): months that start on the user's salary day.

  func testADateBelongsToTheMonthThatStartedOnOrBeforeIt() {
    let c = Fixtures.calendar
    XCTAssertEqual(WidgetSnapshot.periodKey(Fixtures.at(2026, 11, 6), startDay: 7, c), "2026-10")
    XCTAssertEqual(WidgetSnapshot.periodKey(Fixtures.at(2026, 11, 7), startDay: 7, c), "2026-11")
    XCTAssertEqual(WidgetSnapshot.periodKey(Fixtures.at(2026, 1, 3), startDay: 7, c), "2025-12")
    XCTAssertEqual(WidgetSnapshot.periodKey(Fixtures.at(2026, 3, 27), startDay: 28, c), "2026-02")
    XCTAssertEqual(WidgetSnapshot.periodKey(Fixtures.at(2026, 11, 1), startDay: 1, c), "2026-11")
    // The same rule on a stored day's text (an entry made outside the app).
    XCTAssertEqual(WidgetSnapshot.periodKey(ofDay: "2026-12-06T09:00:00", startDay: 7), "2026-11")
    XCTAssertEqual(WidgetSnapshot.periodKey(ofDay: "2026-12-07", startDay: 7), "2026-12")
    XCTAssertEqual(WidgetSnapshot.periodKey(ofDay: "2026-01-03", startDay: 7), "2025-12")
  }

  func testWithAStartDayTheMonthRunsToTheDayBeforeTheNextOne() throws {
    let s = try snapshot("salaryDay")
    XCTAssertEqual(s.startDay, 7)
    XCTAssertEqual(s.monthLabel, "7 Nov – 6 Dec")
    // 1 December is still this month: only today's figure resets.
    let later = try XCTUnwrap(s.asOf(Fixtures.at(2026, 12, 1, 0), Fixtures.calendar))
    XCTAssertEqual(later.monthKey, "2026-11")
    XCTAssertEqual(later.spentMonth, "₹45,029")
    XCTAssertEqual(later.spentToday, "₹0")
    XCTAssertNotNil(later.budget)
    let lastDay = try XCTUnwrap(s.asOf(Fixtures.at(2026, 12, 6, 23), Fixtures.calendar))
    XCTAssertEqual(lastDay.monthKey, "2026-11")
  }

  func testTheMonthRollsOverOnTheStartDayNamedByItsDays() throws {
    let s = try XCTUnwrap(try snapshot("salaryDay").asOf(Fixtures.at(2026, 12, 7, 0), Fixtures.calendar))
    XCTAssertEqual(s.monthKey, "2026-12")
    XCTAssertEqual(s.monthLabel, "7 Dec – 6 Jan")
    XCTAssertEqual(s.spentMonth, "₹0")
    XCTAssertNil(s.budget)
    XCTAssertNil(s.incomeLine)
  }

  func testASnapshotWithoutAStartDayOrWithOneNoMonthIsSureToHaveStartsOnTheFirst() throws {
    XCTAssertEqual(try snapshot("ready").startDay, 1)
    var bad = try snapshot("salaryDay")
    bad.monthStartDay = 31
    XCTAssertEqual(bad.startDay, 1)
    bad.monthStartDay = nil
    XCTAssertEqual(bad.startDay, 1)
  }

  func testAnEntryMadeOutsideTheAppCountsInTheMonthItsDayBelongsTo() throws {
    let s = try snapshot("salaryDay")
    let now = Fixtures.at(2026, 11, 8, 13)
    // 6 November is last month's (7 Oct to 6 Nov): the month figure does not move.
    let before = PendingEntry(id: "a", kind: .expense, amount: 100, categoryId: "cat_food", title: "Tea", date: "2026-11-06T10:00:00")
    XCTAssertEqual(s.applying(before, sign: 1, now: now, Fixtures.calendar).spentMonth, "₹45,029")
    let inside = PendingEntry(id: "b", kind: .expense, amount: 100, categoryId: "cat_food", title: "Tea", date: "2026-11-08T10:00:00")
    XCTAssertEqual(s.applying(inside, sign: 1, now: now, Fixtures.calendar).spentMonth, "₹45,129")
  }
}
