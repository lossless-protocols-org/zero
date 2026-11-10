package com.anotherwhy.zero.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import java.util.Calendar

/**
 * The "This month" home-screen widget. It never reads the database: it draws
 * the snapshot the app last wrote (bridge/WidgetBridgeModule), and redraws on its own
 * only when the date moves (local midnight, a clock or time-zone change), so
 * yesterday's spending never shows as today's.
 */
class ZeroWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    render(context, manager, ids)
    scheduleMidnight(context)
  }

  override fun onAppWidgetOptionsChanged(
      context: Context,
      manager: AppWidgetManager,
      id: Int,
      options: Bundle,
  ) {
    // Android 12+ picks among the responsive layouts itself, but how many
    // category chips fit depends on the width, so every resize redraws.
    render(context, manager, intArrayOf(id))
  }

  override fun onEnabled(context: Context) = scheduleMidnight(context)

  override fun onDisabled(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(midnightIntent(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      midnightAction(context),
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED -> updateAll(context)
    }
  }

  companion object {
    private const val TAG = "ZeroWidget"

    /** Ours by the installed package's name, so a QA build beside the store one never shares it. */
    private fun midnightAction(context: Context) = "${context.packageName}.widget.MIDNIGHT"

    /**
     * Arms the midnight redraw when a widget is placed; nothing otherwise. For
     * MainApplication: an alarm does not survive a reboot, and not every
     * launcher sends APPWIDGET_UPDATE at boot.
     */
    fun rearmMidnight(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      if (manager.getAppWidgetIds(ComponentName(context, ZeroWidgetProvider::class.java)).isNotEmpty()) {
        scheduleMidnight(context)
      }
    }

    /** Redraws every placed widget from the stored snapshot. */
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val ids = manager.getAppWidgetIds(ComponentName(context, ZeroWidgetProvider::class.java))
      if (ids.isEmpty()) return
      render(context, manager, ids)
      scheduleMidnight(context)
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val snapshot = WidgetStore.read(context)
      for (id in ids) {
        try {
          manager.updateAppWidget(id, WidgetRenderer.build(context, manager.getAppWidgetOptions(id), snapshot))
        } catch (e: RuntimeException) {
          // A host that went away mid-update; the next update redraws it.
          Log.w(TAG, "widget $id not updated", e)
        }
      }
    }

    /**
     * Wakes the provider just after the next local midnight. Inexact on
     * purpose (no exact-alarm permission, no wake-up): a sleeping phone
     * redraws as soon as it wakes, before anyone can look at it.
     */
    private fun scheduleMidnight(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val next =
          Calendar.getInstance().apply {
            add(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 5)
            set(Calendar.MILLISECOND, 0)
          }
      alarms.set(AlarmManager.RTC, next.timeInMillis, midnightIntent(context))
    }

    private fun midnightIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, ZeroWidgetProvider::class.java).setAction(midnightAction(context)),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
  }
}
