package com.anotherwhy.zero.quickadd

import android.content.Context
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Log
import com.anotherwhy.zero.R
import com.anotherwhy.zero.widget.WidgetRenderer
import com.anotherwhy.zero.widget.WidgetSnapshot
import com.anotherwhy.zero.widget.WidgetStore

/**
 * Long-press zero's icon: after the two static entries (shortcuts.xml),
 * "repeat my last expense" (the sheet opens filled in, one tap from Save;
 * iOS has it as a Siri shortcut and a control) and the most used category,
 * each straight to the quick-add sheet. Without a last expense (or with
 * amounts hidden) the two most used categories. Updated only when they
 * change (the system rate-limits background updates).
 */
internal object LauncherShortcuts {
  private const val TAG = "ZeroShortcuts"
  /** Two static + two dynamic stays within what every launcher shows (four). */
  private const val DYNAMIC_SHORTCUTS = 2

  fun publish(context: Context, quick: List<WidgetSnapshot.QuickCategory>, last: WidgetSnapshot.Again?) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return
    val top = quick.take(if (last == null) DYNAMIC_SHORTCUTS else DYNAMIC_SHORTCUTS - 1)
    val signature = listOf(last, top).toString()
    if (WidgetStore.signature(context, WidgetStore.KEY_SHORTCUTS) == signature) return
    val manager = context.getSystemService(ShortcutManager::class.java) ?: return
    val repeat =
        last?.let {
          val label = "${it.title} ${it.amountText}"
          ShortcutInfo.Builder(context, "repeat_last")
              .setShortLabel(label)
              .setLongLabel("${context.getString(R.string.widget_add_again)}: $label")
              .setIcon(Icon.createWithResource(context, R.drawable.ic_shortcut_add))
              .setIntent(
                  QuickAdd.intent(
                      context, QuickAdd.KIND_EXPENSE, it.categoryId, WidgetRenderer.plainAmount(it.amount), it.title))
              .setRank(0)
              .build()
        }
    val shortcuts =
        listOfNotNull(repeat) +
            top.mapIndexed { i, category ->
              ShortcutInfo.Builder(context, "quick_${category.id}")
                  .setShortLabel(category.name)
                  .setLongLabel(category.name)
                  .setIcon(Icon.createWithResource(context, R.drawable.ic_shortcut_category))
                  .setIntent(QuickAdd.intent(context, QuickAdd.KIND_EXPENSE, category.id))
                  .setRank(i + (if (repeat == null) 0 else 1))
                  .build()
            }
    try {
      if (manager.setDynamicShortcuts(shortcuts)) {
        WidgetStore.setSignature(context, WidgetStore.KEY_SHORTCUTS, signature)
      }
    } catch (e: RuntimeException) {
      // Rate-limited or refused by the launcher; the next change tries again.
      Log.w(TAG, "launcher shortcuts not updated", e)
    }
  }
}
