import Foundation

/// How zero writes money in the user's currency and locale, as plain rules
/// (2.8). zero's JavaScript reads them from Intl and puts them in the widget
/// snapshot (`moneyFormatSpec` in src/utils/numberUtils.ts); this applies them
/// exactly as `formatWithMoneySpec` does, line for line, so a figure redone
/// here reads the same as the app's. JS tests check the rules against the
/// app's own formatter for ten currency/locale pairs.
struct MoneyFormat: Codable, Equatable {
  /// Text before and after the digits ("₹", " €").
  var prefix: String
  var suffix: String
  /// Group and decimal separators.
  var group: String
  var decimal: String
  /// Digits per group from the right: [3] or [3, 2] (Indian).
  var grouping: [Int]
  /// The currency's own decimals (0, 2 or 3).
  var maxDecimals: Int
  /// The locale's ten digits, 0 to 9.
  var digits: String

  /// `amount` ≥ 0, as the app writes it: whole amounts without decimals,
  /// others with the currency's (at most 2, or all 3 for three-decimal ones).
  func format(_ amount: Decimal) -> String {
    let isWhole = amount == amount.rounded(scale: 0)
    let places = maxDecimals == 3 ? 3 : (isWhole ? 0 : min(2, maxDecimals))
    let fixed = abs(amount).rounded(scale: places)
    let plain = NSDecimalNumber(decimal: fixed).description(withLocale: Locale(identifier: "en_US_POSIX"))
    let pieces = plain.split(separator: ".", maxSplits: 1).map(String.init)
    let whole = pieces.first ?? "0"
    var fraction = pieces.count > 1 ? pieces[1] : ""
    while fraction.count < places { fraction += "0" }

    var groups: [String] = []
    var rest = whole
    var size = grouping.first ?? 0
    while size > 0 && rest.count > size {
      groups.insert(String(rest.suffix(size)), at: 0)
      rest = String(rest.dropLast(size))
      size = grouping.count > 1 ? grouping[1] : size
    }
    groups.insert(rest, at: 0)
    let latin = groups.joined(separator: group) + (places > 0 ? decimal + fraction : "")
    let glyphs = Array(digits)
    let number = String(latin.map { c -> Character in
      guard let d = c.wholeNumberValue, c.isASCII, glyphs.count == 10 else { return c }
      return glyphs[d]
    })
    return prefix + number + suffix
  }
}

extension MoneyFormat {
  /// An amount as it is being typed ("1234.5" → "₹1,234.5"): grouped and in
  /// the locale's digits, the decimals exactly as typed so far.
  func typed(_ text: String) -> String {
    let pieces = text.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
    let whole = pieces.first.flatMap { $0.isEmpty ? nil : $0 } ?? "0"
    var groups: [String] = []
    var rest = whole
    var size = grouping.first ?? 0
    while size > 0 && rest.count > size {
      groups.insert(String(rest.suffix(size)), at: 0)
      rest = String(rest.dropLast(size))
      size = grouping.count > 1 ? grouping[1] : size
    }
    groups.insert(rest, at: 0)
    let latin = groups.joined(separator: group) + (pieces.count > 1 ? decimal + pieces[1] : "")
    let glyphs = Array(digits)
    let number = String(latin.map { c -> Character in
      guard let d = c.wholeNumberValue, c.isASCII, glyphs.count == 10 else { return c }
      return glyphs[d]
    })
    return prefix + number + suffix
  }
}

extension Decimal {
  /// The decimal a JSON number or a `Double` was written as: "123456789.125"
  /// is exactly that, where `Decimal(Double)` keeps the binary expansion
  /// (123456789.1249999872) and repeated adds drift (audit 2026-11-08 §3.8).
  /// Swift prints a Double as its shortest round-tripping decimal, so the
  /// string is the number the app wrote.
  static func shortest(_ value: Double) -> Decimal {
    Decimal(string: "\(value)", locale: Locale(identifier: "en_US_POSIX")) ?? Decimal(value)
  }

  /// Rounded half away from zero to `scale` decimal places (as Intl does).
  func rounded(scale: Int) -> Decimal {
    var value = self
    var result = Decimal()
    NSDecimalRound(&result, &value, scale, .plain)
    return result
  }
}
