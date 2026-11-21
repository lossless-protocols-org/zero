package com.anotherwhy.zero.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.anotherwhy.zero.R
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/** One reminder, as JS plans it (src/pro/reminders.ts). */
data class Reminder(val id: String, val title: String, val body: String, val fireAtMs: Long) {
  fun toJson(): JSONObject =
      JSONObject().put("id", id).put("title", title).put("body", body).put("fireAtMs", fireAtMs)

  companion object {
    fun fromJson(json: JSONObject): Reminder? =
        try {
          Reminder(json.getString("id"), json.getString("title"), json.getString("body"), json.getLong("fireAtMs"))
        } catch (e: JSONException) {
          null
        }

    /** A JSON array as JS sends it; entries that are not reminders are left out. */
    fun listFrom(json: String): List<Reminder> {
      val array = JSONArray(json)
      return (0 until array.length()).mapNotNull { i -> array.optJSONObject(i)?.let(::fromJson) }
    }
  }
}

/**
 * Reminders for recurring rules (3.0, plan P9), Android side. Local only: an
 * inexact alarm per reminder (no exact-alarm permission, allowed while the
 * phone dozes), and a receiver that posts the notification. The list is kept
 * in the app's own preferences, so the boot receiver can arm it again after a
 * restart without JS. Nothing is sent anywhere.
 */
object Reminders {
  private const val PREFS = "zero_reminders"
  private const val KEY = "pending"
  private const val CHANNEL = "reminders"
  const val EXTRA_ID = "id"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun stored(context: Context): List<Reminder> =
      try {
        Reminder.listFrom(prefs(context).getString(KEY, "[]") ?: "[]")
      } catch (e: JSONException) {
        emptyList()
      }

  private fun store(context: Context, reminders: List<Reminder>) {
    val array = JSONArray()
    reminders.forEach { array.put(it.toJson()) }
    prefs(context).edit().putString(KEY, array.toString()).apply()
  }

  /** One alarm per reminder: its own data URI keeps the PendingIntents apart. */
  private fun alarmIntent(context: Context, id: String, flags: Int): PendingIntent? =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, ReminderReceiver::class.java)
              .setAction("${context.packageName}.REMIND")
              .setData(Uri.parse("zero-reminder:$id"))
              .putExtra(EXTRA_ID, id),
          flags or PendingIntent.FLAG_IMMUTABLE,
      )

  /** Replaces every pending reminder with `reminders`: the old alarms cancelled, the new ones armed and stored. */
  fun replaceAll(context: Context, reminders: List<Reminder>) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    for (old in stored(context)) {
      alarmIntent(context, old.id, PendingIntent.FLAG_NO_CREATE)?.let { alarms.cancel(it) }
    }
    val now = System.currentTimeMillis()
    val ahead = reminders.filter { it.fireAtMs > now }
    store(context, ahead)
    arm(context, ahead)
  }

  /** How late a reminder may still be shown: one due while the phone was off comes at boot, not a day later. */
  private const val LATE_MS = 24 * 60 * 60 * 1000L

  /**
   * Arms the stored reminders again (after a restart, or an update of the app).
   * One whose time passed while the phone was off, within the last day, fires
   * at once (an alarm set in the past goes off immediately); older ones are dropped.
   */
  fun rearm(context: Context) {
    val now = System.currentTimeMillis()
    val kept = stored(context).filter { it.fireAtMs > now - LATE_MS }
    store(context, kept)
    arm(context, kept)
  }

  private fun arm(context: Context, reminders: List<Reminder>) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    for (reminder in reminders) {
      val intent = alarmIntent(context, reminder.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: continue
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.fireAtMs, intent)
    }
  }

  /** Posts a stored reminder's notification and forgets it. One that is no longer stored was replaced: nothing. */
  fun post(context: Context, id: String) {
    val all = stored(context)
    val reminder = all.firstOrNull { it.id == id } ?: return
    store(context, all.filter { it.id != id })
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) {
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(
          NotificationChannel(CHANNEL, context.getString(R.string.reminders_channel), NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val open =
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
          PendingIntent.getActivity(
              context,
              0,
              it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
              PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
          )
        }
    val notification =
        NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_widget_logo)
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()
    try {
      manager.notify(reminder.id.hashCode(), notification)
    } catch (e: SecurityException) {
      // Notifications were switched off between the check and here: nothing to show.
    }
  }
}
