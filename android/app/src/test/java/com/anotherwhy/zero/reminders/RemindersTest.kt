package com.anotherwhy.zero.reminders

import android.app.AlarmManager
import android.app.Application
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Reminders, Android side (3.0, plan P9): what JS sends replaces what was
 * pending (alarms and the stored list), only what is still ahead is kept, a
 * fired alarm posts its notification once, and a restart arms the stored
 * list again without JS.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RemindersTest {
  private val app: Application = RuntimeEnvironment.getApplication()
  private val context: Context = app
  private val alarms = shadowOf(app.getSystemService(AlarmManager::class.java))
  private val notifications = shadowOf(app.getSystemService(NotificationManager::class.java))
  private val later = System.currentTimeMillis() + 3_600_000

  private fun json(vararg reminders: Reminder): String =
      reminders.joinToString(",", "[", "]") { it.toJson().toString() }

  @Test
  fun `parses what JS sends and leaves out what is not a reminder`() {
    val list = Reminder.listFrom("""[{"id":"r:1","title":"Rent","body":"Due tomorrow","fireAtMs":5},{"id":2}]""")
    assertEquals(listOf(Reminder("r:1", "Rent", "Due tomorrow", 5)), list)
  }

  @Test
  fun `a new list replaces the old one, alarms and all, and the past is dropped`() {
    Reminders.replaceAll(context, Reminder.listFrom(json(Reminder("a", "Rent", "Due tomorrow", later))))
    assertEquals(1, alarms.scheduledAlarms.size)
    Reminders.replaceAll(
        context,
        listOf(Reminder("b", "Gym", "Due today", later + 1), Reminder("old", "Past", "Due today", 1)),
    )
    assertEquals(listOf("b"), Reminders.stored(context).map { it.id })
    assertEquals(1, alarms.scheduledAlarms.size)
    Reminders.replaceAll(context, emptyList())
    assertEquals(0, alarms.scheduledAlarms.size)
    assertTrue(Reminders.stored(context).isEmpty())
  }

  @Test
  fun `a fired alarm shows its notification once, and only while it is still pending`() {
    shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
    Reminders.replaceAll(context, listOf(Reminder("a", "Rent", "Due tomorrow", later)))
    ReminderReceiver().onReceive(context, Intent().putExtra(Reminders.EXTRA_ID, "a"))
    assertEquals(1, notifications.allNotifications.size)
    assertEquals("Rent", shadowOf(notifications.allNotifications[0]).contentTitle)
    ReminderReceiver().onReceive(context, Intent().putExtra(Reminders.EXTRA_ID, "a"))
    assertEquals(1, notifications.allNotifications.size)
    assertTrue(Reminders.stored(context).isEmpty())
  }

  @Test
  fun `a restart arms the stored reminders again, without JS`() {
    Reminders.replaceAll(context, listOf(Reminder("a", "Rent", "Due tomorrow", later)))
    alarms.scheduledAlarms.toList().forEach { alarm -> alarm.operation?.let { app.getSystemService(AlarmManager::class.java).cancel(it) } }
    assertEquals(0, alarms.scheduledAlarms.size)
    RearmReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
    assertEquals(1, alarms.scheduledAlarms.size)
    assertEquals(later, alarms.scheduledAlarms[0].triggerAtTime)
  }

  @Test
  fun `one due while the phone was off fires at boot, one a day late is dropped`() {
    val now = System.currentTimeMillis()
    Reminders.replaceAll(context, listOf(Reminder("soon", "Rent", "Due today", now + 1_000)))
    // The phone was off past its time: what is stored now is in the past.
    val prefs = context.getSharedPreferences("zero_reminders", Context.MODE_PRIVATE)
    val past = Reminder("missed", "Rent", "Due today", now - 60_000)
    val stale = Reminder("stale", "Gym", "Due today", now - 2 * 24 * 60 * 60 * 1000L)
    prefs.edit().putString("pending", "[${past.toJson()},${stale.toJson()}]").apply()
    RearmReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
    assertEquals(listOf("missed"), Reminders.stored(context).map { it.id })
  }
}
