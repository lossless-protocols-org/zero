package com.anotherwhy.zero.widget

import android.app.AlarmManager
import android.appwidget.AppWidgetManager
import android.content.Context
import org.robolectric.RuntimeEnvironment
import com.anotherwhy.zero.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

/**
 * The midnight redraw (audit 2026-11-08 §6.4): an alarm does not survive a
 * reboot, so the app re-arms it on every start, but only when a widget is
 * placed; the alarm's action is the installed build's own.
 */
@RunWith(RobolectricTestRunner::class)
class ZeroWidgetProviderTest {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val alarms = shadowOf(context.getSystemService(AlarmManager::class.java))

  @Test
  fun `re-arming does nothing without a placed widget`() {
    ZeroWidgetProvider.rearmMidnight(context)
    assertNull(alarms.nextScheduledAlarm)
  }

  @Test
  fun `re-arming with a placed widget schedules the midnight redraw, as this build`() {
    shadowOf(AppWidgetManager.getInstance(context)).createWidget(ZeroWidgetProvider::class.java, R.layout.zero_widget_setup)
    ZeroWidgetProvider.rearmMidnight(context)
    val alarm = checkNotNull(alarms.nextScheduledAlarm) { "no alarm scheduled" }
    val intent = shadowOf(alarm.operation).savedIntent
    assertEquals("${context.packageName}.widget.MIDNIGHT", intent.action)
    assertEquals(ZeroWidgetProvider::class.java.name, intent.component?.className)
  }
}
