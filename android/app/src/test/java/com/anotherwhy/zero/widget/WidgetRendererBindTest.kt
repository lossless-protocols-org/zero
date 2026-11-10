package com.anotherwhy.zero.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import com.anotherwhy.zero.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * What a placed widget draws (audit 2026-11-08 App. B: the Kotlin tests
 * covered the pure core, not bind()). The pinned contract snapshots, bound
 * into the real layouts and inflated: the right layout per size, the figures
 * the app sent, and with amounts hidden not one digit anywhere.
 *
 * Android 11: one layout per widget, picked from the launcher's size (the
 * code path before Android 12's size maps, which the platform resolves).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class WidgetRendererBindTest {
  private val context: Context = RuntimeEnvironment.getApplication()

  private val contract: JSONObject by lazy {
    val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("widget-snapshot-contract.json"))
    JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
  }

  /** A contract snapshot dated today, so "this month" and "today" are the ones it carries. */
  private fun snapshot(name: String): WidgetSnapshot {
    val now = Date()
    val json =
        contract
            .getJSONObject(name)
            .put("monthKey", SimpleDateFormat("yyyy-MM", Locale.US).format(now))
            .put("todayKey", SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now))
    return checkNotNull(WidgetSnapshot.parse(json.toString())) { "$name did not parse" }
  }

  private fun size(widthDp: Int, heightDp: Int) =
      Bundle().apply {
        putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, widthDp)
        putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, heightDp)
      }

  /** Every text the inflated widget shows: a view inside a hidden group is not shown either. */
  private fun textsOf(view: View): List<String> =
      when {
        view.visibility != View.VISIBLE -> emptyList()
        view is TextView -> listOf(view.text.toString())
        view is ViewGroup -> (0 until view.childCount).flatMap { textsOf(view.getChildAt(it)) }
        else -> emptyList()
      }

  private fun draw(name: String, widthDp: Int, heightDp: Int): Pair<Int, List<String>> {
    val views = WidgetRenderer.build(context, size(widthDp, heightDp), snapshot(name))
    return views.layoutId to textsOf(views.apply(context, FrameLayout(context)))
  }

  @Test
  fun `before onboarding, the setup card`() {
    assertEquals(R.layout.zero_widget_setup, WidgetRenderer.build(context, size(250, 250), null).layoutId)
  }

  @Test
  fun `each size gets its layout`() {
    assertEquals(R.layout.zero_widget_tiny, draw("ready", 110, 50).first)
    assertEquals(R.layout.zero_widget_small, draw("ready", 110, 150).first)
    assertEquals(R.layout.zero_widget_medium, draw("ready", 250, 160).first)
    assertEquals(R.layout.zero_widget_large, draw("ready", 250, 300).first)
  }

  @Test
  fun `shows the month and today the app sent`() {
    val ready = contract.getJSONObject("ready")
    val texts = draw("ready", 250, 300).second
    assertTrue(texts.toString(), ready.getString("spentMonth") in texts)
    assertTrue(texts.toString(), ready.getString("spentToday") in texts)
    assertTrue(texts.toString(), ready.getString("monthLabel") in texts)
  }

  @Test
  fun `with amounts hidden, no size shows a single digit`() {
    for ((width, height) in listOf(110 to 50, 110 to 150, 250 to 160, 250 to 300)) {
      val texts = draw("hidden", width, height).second
      assertTrue("$width×$height: $texts", texts.none { text -> text.any(Char::isDigit) })
    }
  }
}
