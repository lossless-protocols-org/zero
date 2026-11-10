package com.anotherwhy.zero.quickadd

import android.content.Context
import android.content.Intent
import org.robolectric.RuntimeEnvironment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Every way into the quick-add sheet (widget chips, the tile, launcher
 * shortcuts) builds its intent in QuickAdd: explicit, a fresh task each time,
 * and carrying what the sheet opens with.
 */
@RunWith(RobolectricTestRunner::class)
class QuickAddTest {
  private val context: Context = RuntimeEnvironment.getApplication()

  @Test
  fun `an add-again intent opens this app's sheet, fresh, filled in`() {
    val intent = QuickAdd.intent(context, QuickAdd.KIND_EXPENSE, "cat_food", "20", "Chai")
    assertEquals(QuickAddActivity::class.java.name, intent.component?.className)
    assertEquals(context.packageName, intent.component?.packageName)
    assertEquals("expense", intent.getStringExtra(QuickAdd.EXTRA_KIND))
    assertEquals("cat_food", intent.getStringExtra(QuickAdd.EXTRA_CATEGORY))
    assertEquals("20", intent.getStringExtra(QuickAdd.EXTRA_AMOUNT))
    assertEquals("Chai", intent.getStringExtra(QuickAdd.EXTRA_TITLE))
    val fresh = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    assertTrue(intent.flags and fresh == fresh)
  }

  @Test
  fun `two chips are two distinct intents, so neither replaces the other's pending intent`() {
    val food = QuickAdd.intent(context, QuickAdd.KIND_EXPENSE, "cat_food")
    val fuel = QuickAdd.intent(context, QuickAdd.KIND_EXPENSE, "cat_fuel")
    assertNotEquals(food.data, fuel.data)
    assertTrue(!food.filterEquals(fuel))
  }

  @Test
  fun `money in opens the sheet as money in, with nothing filled`() {
    val intent = QuickAdd.intent(context, QuickAdd.KIND_INCOME)
    assertEquals("income", intent.getStringExtra(QuickAdd.EXTRA_KIND))
    assertEquals("", intent.getStringExtra(QuickAdd.EXTRA_AMOUNT))
  }
}
