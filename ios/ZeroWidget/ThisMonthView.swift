import SwiftUI
import WidgetKit

struct ThisMonthView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ThisMonthEntry

  var body: some View {
    Group {
      if let snapshot = entry.snapshot, snapshot.ready {
        switch family {
        case .systemSmall: SmallView(s: snapshot)
        case .systemLarge: LargeView(s: snapshot, last: entry.last)
        case .accessoryRectangular: RectangularView(s: snapshot)
        case .accessoryInline: InlineView(s: snapshot)
        default: MediumView(s: snapshot)
        }
      } else {
        SetupView(family: family)
      }
    }
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium || family == .systemLarge {
        ZeroColors.surface
      } else {
        Color.clear
      }
    }
  }
}

// MARK: - Pieces

/// zero's mark: a disc with a 0.
private struct Mark: View {
  var size: CGFloat = 16
  var body: some View {
    Image(systemName: "0.circle.fill")
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(ZeroColors.accent)
      .widgetAccentable()
      .accessibilityHidden(true)
  }
}

/// A round action button that opens the quick-add sheet.
private struct ActionButton: View {
  let url: URL
  let systemImage: String
  let label: String
  var filled = true
  var body: some View {
    Link(destination: url) {
      Image(systemName: systemImage)
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(filled ? ZeroColors.onAccent : ZeroColors.accent)
        .frame(width: 32, height: 32)
        .background(Circle().fill(filled ? AnyShapeStyle(ZeroColors.accent) : AnyShapeStyle(ZeroColors.accent.opacity(0.16))))
        .widgetAccentable()
    }
    .accessibilityLabel(label)
  }
}

private struct Figure: View {
  let text: String
  let size: CGFloat
  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .semibold, design: .rounded))
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.5)
      .privacySensitive()
      .widgetAccentable()
  }
}

private struct TodayLine: View {
  let s: WidgetSnapshot
  var body: some View {
    HStack(spacing: 4) {
      Text(s.labels.today).foregroundStyle(.secondary)
      Text(s.spentToday).fontWeight(.medium).privacySensitive()
    }
    .font(.caption)
    .lineLimit(1)
  }
}

private struct BudgetBar: View {
  let budget: WidgetSnapshot.Budget
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(.quaternary)
        Capsule()
          .fill(budget.over ? ZeroColors.warning : ZeroColors.accent)
          .frame(width: max(4, geo.size.width * budget.progress))
          .widgetAccentable()
      }
    }
    .frame(height: 5)
    .accessibilityHidden(true)
  }
}

private struct BudgetText: View {
  let budget: WidgetSnapshot.Budget
  var body: some View {
    Text(budget.text)
      .font(.caption2)
      .foregroundStyle(budget.over ? ZeroColors.warning : Color.secondary)
      .lineLimit(1)
      .privacySensitive()
  }
}

// MARK: - Families

private struct SmallView: View {
  let s: WidgetSnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      // The month has its own line: beside the button a long month name would be cut.
      HStack(spacing: 6) {
        Mark()
        Spacer(minLength: 0)
        ActionButton(url: ZeroLinks.quick(), systemImage: "plus", label: s.labels.addExpense)
      }
      Spacer(minLength: 0)
      Text(s.monthLabel).font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
      Figure(text: s.spentMonth, size: 30)
      TodayLine(s: s)
      if let budget = s.budget {
        BudgetBar(budget: budget).padding(.top, 3)
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(s.spokenSummary)
  }
}

private struct MediumView: View {
  let s: WidgetSnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 6) {
        Mark()
        Text(s.monthLabel).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        Spacer(minLength: 0)
        ActionButton(
          url: ZeroLinks.quick(kind: "income"), systemImage: "arrow.down.to.line", label: s.labels.addIncome,
          filled: false)
        ActionButton(url: ZeroLinks.quick(), systemImage: "plus", label: s.labels.addExpense)
      }
      Figure(text: s.spentMonth, size: 30)
      HStack(spacing: 8) {
        TodayLine(s: s)
        if let budget = s.budget {
          Text("·").font(.caption).foregroundStyle(.tertiary)
          BudgetText(budget: budget)
        } else if let income = s.incomeLine {
          Text("·").font(.caption).foregroundStyle(.tertiary)
          Text(income).font(.caption2).foregroundStyle(.secondary).lineLimit(1).privacySensitive()
        }
      }
      if let budget = s.budget {
        BudgetBar(budget: budget)
      }
      Spacer(minLength: 0)
      ChipRow(s: s)
    }
  }
}

/// Category chips as wide as their names; as many as fit (4, 3, 2, 1), never a cut name.
private struct ChipRow: View {
  let s: WidgetSnapshot
  var body: some View {
    if let quick = s.quick, !quick.isEmpty {
      ViewThatFits(in: .horizontal) {
        ForEach((1...min(4, quick.count)).reversed(), id: \.self) { count in
          HStack(spacing: 6) {
            ForEach(Array(quick.prefix(count)), id: \.id) { category in
              Chip(category: category, label: s.labels.addExpense)
            }
            Spacer(minLength: 0)
          }
        }
      }
    }
  }
}

/// The medium widget's figures, plus "add again" (one tap adds, zero stays
/// closed) and Undo for the last entry made outside the app.
private struct LargeView: View {
  let s: WidgetSnapshot
  let last: LastAdded?
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Mark()
        Text(s.monthLabel).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        Spacer(minLength: 0)
        ActionButton(
          url: ZeroLinks.quick(kind: "income"), systemImage: "arrow.down.to.line", label: s.labels.addIncome,
          filled: false)
        ActionButton(url: ZeroLinks.quick(), systemImage: "plus", label: s.labels.addExpense)
      }
      Figure(text: s.spentMonth, size: 34)
      HStack(spacing: 8) {
        TodayLine(s: s)
        if let budget = s.budget {
          Text("·").font(.caption).foregroundStyle(.tertiary)
          BudgetText(budget: budget)
        }
      }
      if let budget = s.budget { BudgetBar(budget: budget) }
      if let income = s.incomeLine {
        Text(income).font(.caption2).foregroundStyle(.secondary).lineLimit(1).privacySensitive()
      }
      // "Add again" sits under the figures; the chips keep the bottom edge.
      let again = s.again ?? []
      Text("intents_again").font(.caption.weight(.semibold)).foregroundStyle(.secondary).padding(.top, 8)
      if again.isEmpty {
        Text("intents_again_empty").font(.caption).foregroundStyle(.secondary).lineLimit(2)
      } else {
        ForEach(Array(again.prefix(3)), id: \.self) { AgainButton(again: $0, compact: true) }
      }
      if let last { UndoBar(last: last) }
      Spacer(minLength: 4)
      ChipRow(s: s)
    }
  }
}

/// One tap to the quick-add sheet with this category chosen.
private struct Chip: View {
  let category: WidgetSnapshot.Category
  let label: String
  var body: some View {
    Link(destination: ZeroLinks.quick(categoryId: category.id)) {
      Text(category.name)
        .font(.caption.weight(.medium))
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 12)
        .frame(minHeight: 28)
        .background(Capsule().fill(ZeroColors.accent.opacity(0.16)))
        .widgetAccentable()
    }
    .accessibilityLabel("\(label): \(category.name)")
  }
}

private struct RectangularView: View {
  let s: WidgetSnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: "0.circle.fill").font(.caption2)
        Text(s.monthLabel).font(.caption2).lineLimit(1)
      }
      .foregroundStyle(.secondary)
      Text(s.spentMonth)
        .font(.headline)
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .privacySensitive()
        .widgetAccentable()
      HStack(spacing: 3) {
        Text(s.labels.today)
        Text(s.spentToday).privacySensitive()
      }
      .font(.caption2)
      .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(s.spokenSummary)
  }
}

private struct InlineView: View {
  let s: WidgetSnapshot
  var body: some View {
    Label {
      Text("\(s.spentMonth) · \(s.monthLabel)").privacySensitive()
    } icon: {
      Image(systemName: "0.circle")
    }
  }
}

private struct SetupView: View {
  let family: WidgetFamily
  var body: some View {
    switch family {
    case .accessoryInline:
      Label("widget_open_to_start", systemImage: "0.circle")
    case .accessoryRectangular:
      Label("widget_open_to_start", systemImage: "0.circle").font(.caption)
    default:
      VStack(spacing: 8) {
        Mark(size: 28)
        Text("widget_open_to_start")
          .font(.subheadline.weight(.medium))
          .multilineTextAlignment(.center)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

/// The Lock Screen "Add expense" button.
struct QuickAddCircle: View {
  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      Image(systemName: "plus").font(.title2.weight(.bold)).widgetAccentable()
    }
    .widgetURL(ZeroLinks.quick())
    .accessibilityLabel(Text("intents_control_name"))
    .containerBackground(for: .widget) { Color.clear }
  }
}
