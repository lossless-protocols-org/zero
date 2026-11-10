import Foundation

/// What the widget shows, exactly as src/widgets/snapshot.ts writes it (2.8).
/// Every string is final, translated and formatted by the app; the widget only
/// picks which to show. A snapshot of an unknown version is not read at all:
/// the widget shows "Open zero" and the app writes a fresh one. The JSON the
/// JS builder writes is pinned in contracts/widget-snapshot-contract.json and
/// read by this reader's tests (Tests/ZeroSharedTests) and the Kotlin one's.
struct WidgetSnapshot: Codable, Equatable {
  static let version = 1

  struct Budget: Codable, Equatable {
    var progress: Double
    var over: Bool
    var text: String
  }

  struct Labels: Codable, Equatable {
    var today: String
    var addExpense: String
    var addIncome: String
    var summary: String
  }

  struct Category: Codable, Equatable, Hashable {
    var id: String
    var name: String
  }

  /// An expense to add again with one tap (src/widgets/again.ts).
  struct Again: Codable, Equatable, Hashable {
    var title: String
    var categoryId: String
    var categoryName: String
    var amount: Double
    var amountText: String
  }

  struct Preview: Codable, Equatable {
    var spentMonth: String
    var spentToday: String
    var budgetText: String
  }

  /// Raw figures, money rules and templates, so this side can redo the text
  /// after an entry made outside the app. Absent with amounts hidden.
  struct Live: Codable, Equatable {
    struct Templates: Codable, Equatable {
      var left: String
      var over: String
      var back: String
      var received: String
      var overReceived: String
      var summary: String
    }
    var spentMonth: Decimal
    var spentToday: Decimal
    var received: Decimal
    var budget: Decimal?
    var templates: Templates

    /// JSONDecoder reads numbers as Double before Decimal sees them; going
    /// through `Decimal.shortest` keeps 0.1 as 0.1 (audit 2026-11-08 §3.8).
    init(from decoder: Decoder) throws {
      let c = try decoder.container(keyedBy: CodingKeys.self)
      spentMonth = .shortest(try c.decode(Double.self, forKey: .spentMonth))
      spentToday = .shortest(try c.decode(Double.self, forKey: .spentToday))
      received = .shortest(try c.decode(Double.self, forKey: .received))
      budget = try c.decodeIfPresent(Double.self, forKey: .budget).map(Decimal.shortest)
      templates = try c.decode(Templates.self, forKey: .templates)
    }

    init(spentMonth: Decimal, spentToday: Decimal, received: Decimal, budget: Decimal?, templates: Templates) {
      self.spentMonth = spentMonth
      self.spentToday = spentToday
      self.received = received
      self.budget = budget
      self.templates = templates
    }
  }

  var v: Int
  var state: String
  var locale: String
  var monthKey: String
  var todayKey: String
  var monthLabel: String
  var spentMonth: String
  var spentToday: String
  var zero: String
  var budget: Budget?
  var incomeLine: String?
  var labels: Labels
  var quick: [Category]?
  var categories: [Category]?
  var incomeCategoryId: String?
  /// How money is written (rules, never an amount); nil before onboarding.
  var money: MoneyFormat?
  var live: Live?
  /// Absent in snapshots written before "add again" (read as none).
  var again: [Again]?
  var last: Again?
  var preview: Preview

  var ready: Bool { state == "ready" }

  static func parse(_ json: String?) -> WidgetSnapshot? {
    guard let data = json?.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
      snapshot.v == version
    else { return nil }
    return snapshot.clamped()
  }

  /// What the readers bound at parse time, on both platforms alike: the budget
  /// bar's fill is 0…1 whatever the file says (Kotlin's WidgetSnapshot.parse
  /// does the same), so no view has to (audit 2026-11-08 App. B).
  private func clamped() -> WidgetSnapshot {
    var copy = self
    if let budget = copy.budget {
      copy.budget?.progress = min(max(budget.progress, 0), 1)
    }
    return copy
  }

  func encoded() -> String? {
    guard let data = try? JSONEncoder().encode(self) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  // MARK: - The calendar

  static func monthKey(_ date: Date, _ calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
  }

  static func dayKey(_ date: Date, _ calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.day], from: date)
    return monthKey(date, calendar) + String(format: "-%02d", c.day ?? 0)
  }

  /// The month's stand-alone name ("November"), capitalised as the app shows it.
  static func monthName(_ date: Date, languageTag: String, _ calendar: Calendar = .current) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: languageTag)
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.setLocalizedDateFormatFromTemplate("LLLL")
    let name = formatter.string(from: date)
    return name.prefix(1).uppercased(with: Locale(identifier: languageTag)) + name.dropFirst()
  }

  /// The snapshot as it reads at `now` (same rules as the Android reader):
  /// figures belong to the day and month they were computed for, so once the
  /// date has moved on, today reads zero, and in a new month the month does
  /// too (with its own name), with no budget or money-in line until the app
  /// has computed it. Nil when the clock is earlier than the snapshot's day:
  /// nothing here is known to be true, the widget says "Open zero".
  func asOf(_ now: Date, _ calendar: Calendar = .current) -> WidgetSnapshot? {
    guard ready else { return self }
    let month = Self.monthKey(now, calendar)
    let today = Self.dayKey(now, calendar)
    if monthKey == month && todayKey == today { return self }
    if today < todayKey { return nil }
    var next = self
    next.todayKey = today
    next.spentToday = zero
    next.labels.summary = ""
    next.live?.spentToday = 0
    if monthKey != month {
      next.monthKey = month
      next.monthLabel = Self.monthName(now, languageTag: locale, calendar)
      next.spentMonth = zero
      next.budget = nil
      next.incomeLine = nil
      next.live?.spentMonth = 0
      next.live?.received = 0
      next.live?.budget = nil
    }
    return next
  }

  /// What VoiceOver reads for the figures.
  var spokenSummary: String {
    labels.summary.isEmpty ? "\(monthLabel): \(spentMonth). \(labels.today): \(spentToday)." : labels.summary
  }

  // MARK: - Entries made outside the app

  /// Adds (`sign` 1) or takes back (-1) an entry made outside the app, so
  /// the widget shows it at once; the app saves the entry itself the next
  /// time it runs and then writes the true snapshot. Mirrors
  /// buildWidgetSnapshot for every figure it touches. Without `live` (amounts
  /// hidden) nothing changes: there are no figures to change.
  func applying(_ entry: PendingEntry, sign: Decimal, now: Date, _ calendar: Calendar = .current) -> WidgetSnapshot {
    guard var next = asOf(now, calendar), var live = next.live else { return self }
    let amount = Decimal.shortest(entry.amount) * sign
    let entryMonth = String(entry.date.prefix(7))
    let entryDay = String(entry.date.prefix(10))
    guard entryMonth == next.monthKey else { return next }
    switch entry.kind {
    case .expense:
      live.spentMonth += amount
      if entryDay == next.todayKey { live.spentToday += amount }
    case .income:
      live.received += amount
    }
    next.live = live
    next.rewrite()
    return next
  }

  /// Rewrites every figure from `live`, as the JS builder does.
  private mutating func rewrite() {
    guard let live, let rules = money else { return }
    let money = { (value: Decimal) in rules.format(value) }
    let spend = { (value: Decimal) in
      value < 0 ? Self.fill(live.templates.back, [money(-value)]) : money(value)
    }
    spentMonth = spend(live.spentMonth)
    spentToday = spend(live.spentToday)
    if let total = live.budget, total > 0 {
      let left = total - live.spentMonth
      let share = NSDecimalNumber(decimal: live.spentMonth / total).doubleValue
      budget = Budget(
        progress: max(0, min(1, share)),
        over: left < 0,
        text: left < 0 ? Self.fill(live.templates.over, [money(-left)]) : Self.fill(live.templates.left, [money(left)])
      )
    }
    incomeLine = nil
    if live.received > 0 {
      let kept = live.received - live.spentMonth
      incomeLine =
        kept >= 0
        ? Self.fill(live.templates.received, [money(live.received), money(kept)])
        : Self.fill(live.templates.overReceived, [money(live.received), money(-kept)])
    }
    labels.summary = Self.fill(live.templates.summary, [monthLabel, spentMonth, spentToday])
  }

  /// Fills "%@" or "%1$@ … %2$@" with `values` (the templates come from the
  /// app's own translations, so word order follows the language).
  static func fill(_ template: String, _ values: [String]) -> String {
    var out = template
    for (i, value) in values.enumerated() {
      out = out.replacingOccurrences(of: "%\(i + 1)$@", with: value)
    }
    if let first = values.first {
      out = out.replacingOccurrences(of: "%@", with: first)
    }
    return out
  }
}

/// An entry made outside the app, waiting for the app to save it (the queue
/// src/widgets/pendingEntries.ts drains).
struct PendingEntry: Codable, Equatable {
  enum Kind: String, Codable { case expense, income }
  var id: String
  var kind: Kind
  var amount: Double
  var categoryId: String
  /// The expense's title or the money in's note; may be empty.
  var title: String
  /// Local date-time "YYYY-MM-DDTHH:mm:ss".
  var date: String

  static func localDateTime(_ date: Date, _ calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
    return String(
      format: "%04d-%02d-%02dT%02d:%02d:%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0, c.hour ?? 0,
      c.minute ?? 0, c.second ?? 0)
  }
}

/// One entry of the Home Screen quick actions (long-press zero's icon, 2.8):
/// what the app installs (ZeroQuickActions, app target only, since a widget
/// extension cannot touch UIApplication). The same menu as Android's launcher
/// shortcuts (quickadd/LauncherShortcuts.kt).
struct QuickAction: Equatable {
  static let typePrefix = "com.anotherwhy.zero.quick."
  var type: String
  var title: String
  var subtitle: String?
  /// An SF Symbol.
  var symbol: String
  /// zero://quick…, see src/navigation/linking.ts.
  var url: URL
}

extension WidgetSnapshot {
  /// After "Add expense" and "Money in", as on Android.
  private static let dynamicQuickActions = 2

  /// The quick actions, in order: "Add expense", "Money in", then "Add again"
  /// (the latest expense, the sheet filled in) and the most used category, or
  /// the two most used categories when there is no latest expense (none with
  /// amounts hidden). Four, what the Home Screen shows. Empty before onboarding,
  /// when the links would lead nowhere.
  func quickActions() -> [QuickAction] {
    guard ready else { return [] }
    var actions = [
      QuickAction(
        type: QuickAction.typePrefix + "expense", title: String(localized: "widget_add_expense"), subtitle: nil,
        symbol: "plus", url: Self.quickLink(kind: "expense")),
      QuickAction(
        type: QuickAction.typePrefix + "income", title: String(localized: "widget_add_income"), subtitle: nil,
        symbol: "arrow.down", url: Self.quickLink(kind: "income")),
    ]
    if let last {
      actions.append(
        QuickAction(
          type: QuickAction.typePrefix + "again", title: "\(last.title) \(last.amountText)",
          subtitle: String(localized: "intents_again"), symbol: "arrow.counterclockwise",
          url: Self.quickLink(
            kind: "expense", categoryId: last.categoryId, amount: Self.plainAmount(last.amount), title: last.title)))
    }
    let room = Self.dynamicQuickActions - (last == nil ? 0 : 1)
    for category in (quick ?? []).prefix(room) {
      actions.append(
        QuickAction(
          type: QuickAction.typePrefix + "category", title: category.name, subtitle: nil, symbol: "tag",
          url: Self.quickLink(kind: "expense", categoryId: category.id)))
    }
    return actions
  }

  /// RFC 3986 unreserved characters: everything else in a value is percent-encoded.
  private static let unreserved = CharacterSet(
    charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

  /// zero://quick?kind=…[&categoryId=…][&amount=…][&title=…]. Encoded here, not
  /// by `queryItems`, which leaves "&", "=" and "+" as they are: a title
  /// "Chai & bun" would otherwise split the query.
  static func quickLink(kind: String, categoryId: String? = nil, amount: String? = nil, title: String? = nil) -> URL {
    var components = URLComponents()
    components.scheme = "zero"
    components.host = "quick"
    let pairs: [(String, String?)] = [("kind", kind), ("categoryId", categoryId), ("amount", amount), ("title", title)]
    components.percentEncodedQueryItems = pairs.compactMap { name, value in
      value.map { URLQueryItem(name: name, value: $0.addingPercentEncoding(withAllowedCharacters: unreserved)) }
    }
    // Fixed scheme and host, encoded values: always a valid URL.
    return components.url ?? URL(fileURLWithPath: "/")
  }

  /// An amount as someone would type it: "20", "12.5" (Android's plainAmount).
  static func plainAmount(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.numberStyle = .decimal
    formatter.usesGroupingSeparator = false
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 6
    return formatter.string(from: NSNumber(value: amount)) ?? ""
  }
}
