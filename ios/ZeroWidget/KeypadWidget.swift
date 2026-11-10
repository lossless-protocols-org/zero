import AppIntents
import SwiftUI
import WidgetKit

/// "Quick add" (2.8): a keypad on the Home Screen. Type the amount on its keys
/// and tap a category: the expense is added and "This month" redrawn, and zero
/// never opens. A widget cannot show a keyboard, so the keys are its own
/// buttons (each runs KeypadKeyIntent in the widget extension). A half-typed
/// amount is forgotten after a few minutes; Undo is offered for two.
struct KeypadWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZeroKeypad", provider: KeypadProvider()) { entry in
      KeypadView(entry: entry)
    }
    .configurationDisplayName("intents_keypad_name")
    .description("intents_keypad_description")
    .supportedFamilies([.systemLarge])
  }
}

struct KeypadEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
  /// The amount typed so far, ASCII digits and ".", "" when none.
  let text: String
  let last: LastAdded?
}

struct KeypadProvider: TimelineProvider {
  func placeholder(in context: Context) -> KeypadEntry {
    KeypadEntry(date: Date(), snapshot: .sample(from: SharedStore.snapshot()), text: "", last: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (KeypadEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<KeypadEntry>) -> Void) {
    let now = Date()
    // Redraw when the typed amount goes stale and when Undo stops being offered.
    let later = [SharedStore.keypadExpiry(now: now), SharedStore.lastAdded(now: now)?.at.addingTimeInterval(SharedStore.undoLifetime)]
      .compactMap { $0 }
      .sorted()
      .map { entry(at: $0.addingTimeInterval(1)) }
    completion(Timeline(entries: [entry(at: now)] + later, policy: .never))
  }

  private func entry(at date: Date) -> KeypadEntry {
    KeypadEntry(
      date: date, snapshot: SharedStore.snapshot()?.asOf(date), text: SharedStore.keypadText(now: date),
      last: SharedStore.lastAdded(now: date))
  }
}

struct KeypadView: View {
  let entry: KeypadEntry

  var body: some View {
    Group {
      if let s = entry.snapshot, s.ready {
        content(s)
      } else {
        VStack(spacing: 8) {
          Image(systemName: "0.circle.fill").font(.system(size: 28, weight: .semibold))
            .foregroundStyle(ZeroColors.accent)
          Text("widget_open_to_start").font(.subheadline.weight(.medium)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .containerBackground(for: .widget) { ZeroColors.surface }
  }

  private func content(_ s: WidgetSnapshot) -> some View {
    let hasAmount = KeypadState.amount(entry.text) != nil
    return VStack(alignment: .leading, spacing: 10) {
      // What is typed, or the last entry with Undo, or the hint.
      Group {
        if !entry.text.isEmpty {
          Text(s.money?.typed(entry.text) ?? entry.text)
            .font(.system(size: 34, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .contentTransition(.numericText())
        } else if let last = entry.last {
          UndoBar(last: last).frame(height: 40)
        } else {
          HStack(spacing: 6) {
            Image(systemName: "0.circle.fill").foregroundStyle(ZeroColors.accent).widgetAccentable()
            Text("intents_type_amount").font(.title3.weight(.medium)).foregroundStyle(.secondary)
          }
        }
      }
      .frame(height: 40, alignment: .leading)

      HStack(alignment: .top, spacing: 12) {
        keypad(s).frame(maxWidth: .infinity, maxHeight: .infinity)
        categories(s, enabled: hasAmount).frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  // MARK: Keys

  private func keypad(_ s: WidgetSnapshot) -> some View {
    let point = (s.money?.maxDecimals ?? 2) > 0 ? "." : nil
    let rows: [[String?]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [point, "0", "back"]]
    return Grid(horizontalSpacing: 6, verticalSpacing: 6) {
      ForEach(0..<rows.count, id: \.self) { r in
        GridRow {
          ForEach(0..<3, id: \.self) { c in
            if let key = rows[r][c] {
              Key(key: key, label: label(key, s))
            } else {
              Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
          }
        }
      }
    }
  }

  /// A key's face: the locale's digit, its decimal separator, or ⌫.
  private func label(_ key: String, _ s: WidgetSnapshot) -> String {
    if key == "." { return s.money?.decimal ?? "." }
    guard let d = Int(key), let digits = s.money?.digits, digits.count == 10 else { return key }
    return String(Array(digits)[d])
  }

  // MARK: Categories

  private func categories(_ s: WidgetSnapshot, enabled: Bool) -> some View {
    VStack(spacing: 6) {
      ForEach(Array((s.quick ?? []).prefix(4)), id: \.id) { category in
        SaveButton(
          intent: KeypadSaveIntent(categoryId: category.id), title: category.name, systemImage: nil, enabled: enabled)
      }
      SaveButton(
        intent: KeypadSaveIntent(categoryId: s.incomeCategoryId ?? "", income: true), title: s.labels.addIncome,
        systemImage: "arrow.down.to.line", enabled: enabled)
    }
  }
}

private struct Key: View {
  let key: String
  let label: String
  var body: some View {
    Button(intent: KeypadKeyIntent(key)) {
      Group {
        if key == "back" {
          Image(systemName: "delete.left").font(.system(size: 17, weight: .medium))
        } else {
          Text(label).font(.system(size: 20, weight: .medium, design: .rounded))
        }
      }
      .frame(maxWidth: .infinity, minHeight: 40, maxHeight: .infinity)
      .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.quaternary.opacity(0.6)))
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(key == "back" ? Text("intents_delete_key") : Text(label))
  }
}

private struct SaveButton: View {
  let intent: KeypadSaveIntent
  let title: String
  let systemImage: String?
  let enabled: Bool
  var body: some View {
    Button(intent: intent) {
      HStack(spacing: 6) {
        if let systemImage { Image(systemName: systemImage).font(.caption.weight(.bold)) }
        Text(title).font(.subheadline.weight(.medium)).lineLimit(1).minimumScaleFactor(0.8)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 10)
      .frame(maxWidth: .infinity, minHeight: 32, maxHeight: .infinity)
      .background(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(enabled ? AnyShapeStyle(ZeroColors.accent.opacity(0.22)) : AnyShapeStyle(.quaternary.opacity(0.4)))
      )
      .foregroundStyle(enabled ? Color.primary : Color.secondary)
      .widgetAccentable()
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}
