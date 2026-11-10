import XCTest

@testable import ZeroShared

/// MoneyFormat is the Swift twin of the app's formatWithMoneySpec: the widget
/// and Siri redo figures with it while the app is closed. Every case in
/// contracts/money-format-cases.json comes from the app's own formatter (the
/// JS test pins and regenerates the file), so the two are held to the same
/// answers (audit 2026-11-08 §6.1).
final class MoneyFormatTests: XCTestCase {
  private struct Case: Decodable {
    var currency: String
    var locale: String
    var spec: MoneyFormat
    var amount: Double
    var text: String
  }

  func testEveryPinnedCaseReadsTheSameAsTheApp() throws {
    let cases = try JSONDecoder().decode([Case].self, from: Fixtures.data("money-format-cases.json"))
    XCTAssertGreaterThanOrEqual(cases.count, 100)
    for c in cases {
      XCTAssertEqual(c.spec.format(.shortest(c.amount)), c.text, "\(c.currency) in \(c.locale): \(c.amount)")
    }
  }

  func testTypingGroupsAndKeepsTheDecimalsAsTyped() throws {
    let cases = try JSONDecoder().decode([Case].self, from: Fixtures.data("money-format-cases.json"))
    let inr = try XCTUnwrap(cases.first { $0.currency == "INR" }?.spec)
    XCTAssertEqual(inr.typed("1234567.5"), "₹12,34,567.5")
    XCTAssertEqual(inr.typed("12."), "₹12.")
    XCTAssertEqual(inr.typed(""), "₹0")
  }
}

/// Decimal.shortest: the number the app wrote, not the Double's binary expansion (audit §3.8).
final class DecimalShortestTests: XCTestCase {
  func testKeepsTheWrittenDecimal() {
    XCTAssertEqual(Decimal.shortest(123456789.125), Decimal(string: "123456789.125"))
    XCTAssertNotEqual(Decimal(123456789.125), Decimal(string: "123456789.125"))  // the drift it replaces
    XCTAssertEqual(Decimal.shortest(0.1), Decimal(string: "0.1"))
    XCTAssertEqual(Decimal.shortest(1e-7), Decimal(string: "0.0000001"))
    XCTAssertEqual(Decimal.shortest(1e15), Decimal(string: "1000000000000000"))
  }

  func testSnapshotFiguresDecodeExactly() throws {
    let json = try Fixtures.contract("ready") { object in
      var live = object["live"] as? [String: Any] ?? [:]
      live["spentMonth"] = 123456789.125
      object["live"] = live
    }
    XCTAssertEqual(WidgetSnapshot.parse(json)?.live?.spentMonth, Decimal(string: "123456789.125"))
  }
}
