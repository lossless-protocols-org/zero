package com.anotherwhy.zero.widget

import android.content.Context
import org.robolectric.RuntimeEnvironment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The widget's only storage (2.8): the app's last snapshot, written only when
 * it says something new, so the app coming to the foreground does not redraw
 * every widget; and the signatures of rate-limited system calls.
 */
@RunWith(RobolectricTestRunner::class)
class WidgetStoreTest {
  private val context: Context = RuntimeEnvironment.getApplication()

  private fun snapshot(spent: String, computedAt: Long) =
      """{"v":1,"state":"setup","computedAt":$computedAt,"spentMonth":"$spent"}"""

  @Test
  fun `nothing is stored until the app writes`() {
    assertNull(WidgetStore.read(context))
  }

  @Test
  fun `a new snapshot is stored and reported as a change`() {
    assertTrue(WidgetStore.write(context, snapshot("₹10", 1)))
    assertTrue(WidgetStore.write(context, snapshot("₹20", 2)))
  }

  @Test
  fun `the same figures computed again are not a change`() {
    assertTrue(WidgetStore.write(context, snapshot("₹10", 1)))
    assertFalse(WidgetStore.write(context, snapshot("₹10", 99)))
  }

  @Test
  fun `a signature is kept until replaced`() {
    assertNull(WidgetStore.signature(context, WidgetStore.KEY_SHORTCUTS))
    WidgetStore.setSignature(context, WidgetStore.KEY_SHORTCUTS, "a")
    WidgetStore.setSignature(context, WidgetStore.KEY_SHORTCUTS, "b")
    assertEquals("b", WidgetStore.signature(context, WidgetStore.KEY_SHORTCUTS))
  }
}
