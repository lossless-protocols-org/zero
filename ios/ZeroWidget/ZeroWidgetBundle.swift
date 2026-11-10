import AppIntents
import SwiftUI
import WidgetKit

/// zero's widgets (2.8 Phase 4), in gallery order: "This month" (Home Screen
/// and Lock Screen), "Add expense" (a Lock Screen button) and, from iOS 18, an
/// "Add expense" control for Control Center, the Lock Screen and the Action
/// Button. All of them read the snapshot the app writes to the App Group;
/// none opens zero's database.
@main
struct ZeroWidgets: WidgetBundle {
  var body: some Widget {
    ThisMonthWidget()
    KeypadWidget()
    QuickAddLockWidget()
    if #available(iOS 18.0, *) {
      QuickAddControl()
      MoneyInControl()
      RepeatLastControl()
    }
  }
}

struct ThisMonthWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZeroThisMonth", provider: ThisMonthProvider()) { entry in
      ThisMonthView(entry: entry)
    }
    .configurationDisplayName("widget_name")
    .description("widget_description")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
  }
}

/// One tap from the Lock Screen to the quick-add sheet.
struct QuickAddLockWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ZeroQuickAdd", provider: ThisMonthProvider()) { _ in
      QuickAddCircle()
    }
    .configurationDisplayName("intents_control_name")
    .description("intents_control_description")
    .supportedFamilies([.accessoryCircular])
  }
}

/// Control Center, the Lock Screen and the Action Button (iOS 18+). A
/// control cannot ask for a value (tested: the system stops at "needs value"
/// with no prompt), so "Add expense" and "Money in" open zero's quick-add
/// sheet, and "Repeat last expense", which needs nothing, adds without
/// opening zero. Typing an amount with zero closed is the keypad widget's,
/// Siri's, Spotlight's and the Action Button's (the "Add expense" shortcut).
@available(iOS 18.0, *)
struct QuickAddControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "ZeroQuickAddControl") {
      ControlWidgetButton(action: OpenURLIntent(ZeroLinks.quick())) {
        Label("intents_control_name", systemImage: "plus.circle")
      }
    }
    .displayName("intents_control_name")
    .description("intents_control_description")
  }
}

@available(iOS 18.0, *)
struct MoneyInControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "ZeroMoneyInControl") {
      ControlWidgetButton(action: OpenURLIntent(ZeroLinks.quick(kind: "income"))) {
        Label("widget_add_income", systemImage: "arrow.down.circle")
      }
    }
    .displayName("widget_add_income")
    .description("intents_money_in_control_description")
  }
}

@available(iOS 18.0, *)
struct RepeatLastControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "ZeroRepeatLastControl") {
      ControlWidgetButton(action: RepeatLastExpenseIntent()) {
        Label("intents_repeat_last", systemImage: "arrow.clockwise.circle")
      }
    }
    .displayName("intents_repeat_last")
    .description("intents_repeat_last_description")
  }
}
