import XCTest

@testable import ZeroShared

/// The Home Screen quick actions (long-press zero's icon, 2.8): the same menu
/// as Android's launcher shortcuts, from the same snapshot (contracts/).
final class QuickActionsTests: XCTestCase {
  private func actions(_ key: String, editing edit: (inout [String: Any]) -> Void = { _ in }) throws -> [QuickAction] {
    try XCTUnwrap(WidgetSnapshot.parse(try Fixtures.contract(key, editing: edit))).quickActions()
  }

  private func query(_ url: URL) -> [String: String] {
    let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
    return Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
  }

  func testAddExpenseMoneyInAddAgainAndTheTopCategory() throws {
    let menu = try actions("ready")
    XCTAssertEqual(menu.map(\.type), ["expense", "income", "again", "category"].map { QuickAction.typePrefix + $0 })
    XCTAssertEqual(menu.map(\.url.host), ["quick", "quick", "quick", "quick"])
    XCTAssertEqual(query(menu[0].url), ["kind": "expense"])
    XCTAssertEqual(query(menu[1].url), ["kind": "income"])
    XCTAssertEqual(menu[2].title, "Chai ₹20")
    XCTAssertEqual(query(menu[2].url), ["kind": "expense", "categoryId": "cat_food", "amount": "20", "title": "Chai"])
    XCTAssertEqual(menu[3].title, "Food")
    XCTAssertEqual(query(menu[3].url)["categoryId"], try XCTUnwrap(WidgetSnapshot.parse(Fixtures.contract("ready"))?.quick?.first?.id))
  }

  func testWithAmountsHiddenTheTwoTopCategoriesAndNoAmountAnywhere() throws {
    let menu = try actions("hidden")
    XCTAssertEqual(menu.map(\.type).suffix(2), [QuickAction.typePrefix + "category", QuickAction.typePrefix + "category"])
    XCTAssertEqual(menu.suffix(2).map(\.title), ["Food", "Grocery"])
    XCTAssertTrue(menu.allSatisfy { query($0.url)["amount"] == nil })
  }

  func testNothingBeforeOnboarding() throws {
    XCTAssertEqual(try actions("setup"), [])
  }

  func testNoCategoriesYetLeavesTheTwoFixedEntries() throws {
    XCTAssertEqual(try actions("underBudget").count, 2)
  }

  func testATitleWithLinkCharactersSurvivesTheRoundTrip() throws {
    let menu = try actions("ready") { object in
      object["last"] = ["title": "Chai & bun = 2+1 50%", "categoryId": "cat/food?x", "categoryName": "Food", "amount": 12.5, "amountText": "₹12.50"]
    }
    let again = try XCTUnwrap(menu.first { $0.type == QuickAction.typePrefix + "again" })
    XCTAssertEqual(query(again.url)["title"], "Chai & bun = 2+1 50%")
    XCTAssertEqual(query(again.url)["categoryId"], "cat/food?x")
    XCTAssertEqual(query(again.url)["amount"], "12.5")
  }

  func testAmountsReadAsTyped() {
    XCTAssertEqual(WidgetSnapshot.plainAmount(20), "20")
    XCTAssertEqual(WidgetSnapshot.plainAmount(12.5), "12.5")
    XCTAssertEqual(WidgetSnapshot.plainAmount(1234567.25), "1234567.25")
    XCTAssertEqual(WidgetSnapshot.plainAmount(0.01), "0.01")
  }
}
