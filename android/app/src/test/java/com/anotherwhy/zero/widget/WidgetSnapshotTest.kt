package com.anotherwhy.zero.widget

import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The widget's reader (2.8). The JSON comes from the pinned contract that
 * __tests__/widgetContract.test.ts checks the JS writer against, so a format
 * change on either side fails one of the two suites. Under Robolectric since
 * 3.0 (P11): a month named by its days is formatted with Android's own
 * locale patterns.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetSnapshotTest {

  private val contract: JSONObject by lazy {
    val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("widget-snapshot-contract.json")) {
      "widget-snapshot-contract.json missing from contracts/ (android/app/build.gradle test resources)"
    }
    JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
  }

  private fun snapshot(name: String): WidgetSnapshot =
      checkNotNull(WidgetSnapshot.parse(contract.getJSONObject(name).toString())) { "$name did not parse" }

  /** A local date-time in a fixed zone, so the tests do not depend on the machine. */
  private fun at(year: Int, month: Int, day: Int, hour: Int = 12): Calendar =
      Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"), Locale.US).apply {
        clear()
        set(year, month - 1, day, hour, 0, 0)
      }

  @Test
  fun `reads every field the JS writer sends`() {
    val s = snapshot("ready")
    assertTrue(s.ready)
    assertEquals("en-IN", s.locale)
    assertEquals("2026-11", s.monthKey)
    assertEquals("2026-11-06", s.todayKey)
    assertEquals("November", s.monthLabel)
    assertEquals("₹45,029", s.spentMonth)
    assertEquals("₹120", s.spentToday)
    assertEquals("₹0", s.zero)
    assertEquals(WidgetSnapshot.Budget(1.0, true, "₹15,029 over budget"), s.budget)
    assertEquals("Received ₹80,000 · Kept ₹34,971", s.incomeLine)
    assertEquals("Add expense", s.labels.addExpense)
    assertEquals("Money in", s.labels.addIncome)
    assertEquals("November: ₹45,029 spent. Today: ₹120.", s.labels.summary)
    assertEquals(
        listOf(WidgetSnapshot.QuickCategory("cat_food", "Food"), WidgetSnapshot.QuickCategory("cat_grocery", "Grocery")),
        s.quick,
    )
    assertEquals("₹12,345", s.preview.spentMonth)
    assertEquals("₹2,655 left", s.preview.budgetText)
    assertEquals(listOf(WidgetSnapshot.Again("Chai", "cat_food", 20.0, "₹20")), s.again)
  }

  @Test
  fun `add again is empty with amounts hidden`() {
    assertTrue(snapshot("hidden").again.isEmpty())
  }

  @Test
  fun `the last expense is read for repeat last, and absent with amounts hidden`() {
    assertEquals(WidgetSnapshot.Again("Chai", "cat_food", 20.0, "₹20"), snapshot("ready").last)
    assertNull(snapshot("hidden").last)
  }

  @Test
  fun `hidden amounts arrive as dots with no budget, under budget reads as left`() {
    val hidden = snapshot("hidden")
    assertEquals("••••", hidden.spentMonth)
    assertNull(hidden.budget)
    val under = snapshot("underBudget")
    assertEquals(WidgetSnapshot.Budget(0.25, false, "₹22,500 left"), under.budget)
    assertNull(under.incomeLine)
    assertTrue(under.quick.isEmpty())
  }

  @Test
  fun `the setup state reads as not ready`() {
    assertFalse(snapshot("setup").ready)
  }

  @Test
  fun `every contract snapshot carries the version this reader reads`() {
    // The JS writer emits the fixture (WIDGET_SNAPSHOT_VERSION) and the Swift
    // reader pins it too, so the three version literals cannot drift apart
    // unseen (audit 2026-11-08 App. B).
    for (name in contract.keys()) {
      assertEquals(name, WidgetSnapshot.VERSION, contract.getJSONObject(name).getInt("v"))
    }
  }

  @Test
  fun `an unknown version, broken JSON or nothing is not read at all`() {
    val newer = contract.getJSONObject("ready").put("v", 2).toString()
    assertNull(WidgetSnapshot.parse(newer))
    assertNull(WidgetSnapshot.parse("{not json"))
    assertNull(WidgetSnapshot.parse(""))
    assertNull(WidgetSnapshot.parse(null))
    val missingLabels = JSONObject(contract.getJSONObject("ready").toString()).apply { remove("labels") }
    assertNull(WidgetSnapshot.parse(missingLabels.toString()))
  }

  @Test
  fun `a snapshot written before quick add has no chips and nothing else changes`() {
    val old = JSONObject(contract.getJSONObject("ready").toString()).apply { remove("quick") }
    val s = checkNotNull(WidgetSnapshot.parse(old.toString()))
    assertTrue(s.quick.isEmpty())
    assertEquals("₹45,029", s.spentMonth)
  }

  @Test
  fun `the same day reads unchanged`() {
    val s = snapshot("ready")
    assertSame(s, s.asOf(at(2026, 11, 6, 23)))
  }

  @Test
  fun `the next day today reads zero and the month stays`() {
    val s = checkNotNull(snapshot("ready").asOf(at(2026, 11, 7, 0)))
    assertEquals("₹0", s.spentToday)
    assertEquals("₹45,029", s.spentMonth)
    assertNotNull(s.budget)
    assertEquals("November: ₹45,029. Today: ₹0.", s.spokenSummary())
  }

  @Test
  fun `a new month reads zero with its own name and no budget or money in`() {
    val s = checkNotNull(snapshot("ready").asOf(at(2026, 12, 1, 0)))
    assertEquals("December", s.monthLabel)
    assertEquals("₹0", s.spentMonth)
    assertEquals("₹0", s.spentToday)
    assertNull(s.budget)
    assertNull(s.incomeLine)
    assertEquals("2026-12", s.monthKey)
  }

  @Test
  fun `a new year rolls the same way`() {
    val s = checkNotNull(snapshot("ready").asOf(at(2027, 1, 1, 0)))
    assertEquals("January", s.monthLabel)
    assertEquals("2027-01", s.monthKey)
  }

  @Test
  fun `a clock moved back past the snapshot day makes the figures unknown`() {
    assertNull(snapshot("ready").asOf(at(2026, 11, 5, 23)))
  }

  @Test
  fun `month names follow the snapshot language`() {
    assertEquals("Décembre", WidgetSnapshot.monthName(at(2026, 12, 1), "fr-FR"))
    assertEquals("Dezembro", WidgetSnapshot.monthName(at(2026, 12, 1), "pt-BR"))
  }

  // 3.0 (P11): months that start on the user's salary day.

  @Test
  fun `a date belongs to the month that started on or before it`() {
    assertEquals("2026-10", WidgetSnapshot.periodKeyOf(at(2026, 11, 6), 7))
    assertEquals("2026-11", WidgetSnapshot.periodKeyOf(at(2026, 11, 7), 7))
    assertEquals("2025-12", WidgetSnapshot.periodKeyOf(at(2026, 1, 3), 7))
    assertEquals("2026-02", WidgetSnapshot.periodKeyOf(at(2026, 3, 27), 28))
    assertEquals("2026-11", WidgetSnapshot.periodKeyOf(at(2026, 11, 1), 1))
  }

  @Test
  fun `with a start day the month runs to the day before the next one`() {
    val s = snapshot("salaryDay")
    assertEquals(7, s.monthStartDay)
    assertEquals("7 Nov – 6 Dec", s.monthLabel)
    // 1 December is still this month: only today's figure resets.
    val later = checkNotNull(s.asOf(at(2026, 12, 1, 0)))
    assertEquals("2026-11", later.monthKey)
    assertEquals("₹45,029", later.spentMonth)
    assertEquals("₹0", later.spentToday)
    assertNotNull(later.budget)
    val lastDay = checkNotNull(s.asOf(at(2026, 12, 6, 23)))
    assertEquals("2026-11", lastDay.monthKey)
  }

  @Test
  fun `the month rolls over on the start day, named by its days`() {
    val s = checkNotNull(snapshot("salaryDay").asOf(at(2026, 12, 7, 0)))
    assertEquals("2026-12", s.monthKey)
    assertEquals("7 Dec – 6 Jan", s.monthLabel)
    assertEquals("₹0", s.spentMonth)
    assertNull(s.budget)
    assertNull(s.incomeLine)
    assertEquals(7, s.monthStartDay)
  }

  @Test
  fun `a snapshot without a start day, or with one no month is sure to have, starts on the 1st`() {
    val old = JSONObject(contract.getJSONObject("ready").toString()).apply { remove("monthStartDay") }
    assertEquals(1, checkNotNull(WidgetSnapshot.parse(old.toString())).monthStartDay)
    val bad = JSONObject(contract.getJSONObject("salaryDay").toString()).put("monthStartDay", 31)
    assertEquals(1, checkNotNull(WidgetSnapshot.parse(bad.toString())).monthStartDay)
  }

  @Test
  fun `a month's label is its name from the 1st, its days otherwise, in the snapshot language`() {
    val now = at(2026, 11, 20)
    assertEquals("November", WidgetSnapshot.monthLabelFor("2026-11", 1, "en-IN", now))
    assertEquals("28 Feb – 27 Mar", WidgetSnapshot.monthLabelFor("2026-02", 28, "en-IN", now))
    assertEquals("15 Dec – 14 Jan", WidgetSnapshot.monthLabelFor("2026-12", 15, "en-IN", now))
  }
}
