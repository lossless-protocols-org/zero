package com.anotherwhy.zero.widget

import com.anotherwhy.zero.widget.WidgetRenderer.Layout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Which layout each launcher size gets (2.8). Sizes in dp, from the platform
 * grid (73n-16 wide, 118m-16 tall in portrait) and the two launchers measured
 * on device (screenshots, 2026-11-06): the Moto (Android 15) 2×1 ≈ 183×103,
 * 2×2 ≈ 183×221, 4×1 ≈ 381×103, 4×2 ≈ 381×221; the Pixel (Android 17) 4×2
 * ≈ 373×204.
 */
class WidgetRendererLayoutTest {

  private fun layout(width: Int, height: Int) = WidgetRenderer.layoutFor(width, height)

  @Test
  fun `the grid sizes get their layouts`() {
    assertEquals(Layout.TINY, layout(130, 102 - 30)) // 2×1 on a short-row launcher
    assertEquals(Layout.TINY, layout(130, 102))
    assertEquals(Layout.WIDE, layout(276, 102)) // 4×1
    assertEquals(Layout.WIDE, layout(230, 90)) // 3×1 and wider
    assertEquals(Layout.SMALL_TALL, layout(130, 220)) // 2×2 with room for the budget
    assertEquals(Layout.SMALL, layout(130, 160)) // 2×2 on a short-row launcher
    assertEquals(Layout.MEDIUM_QUICK, layout(276, 220)) // 4×2
    assertEquals(Layout.LARGE, layout(276, 337)) // 4×3
  }

  @Test
  fun `the launchers measured on device`() {
    assertEquals(Layout.TINY, layout(183, 103)) // Moto 2×1
    assertEquals(Layout.SMALL_TALL, layout(183, 221)) // Moto 2×2
    assertEquals(Layout.WIDE, layout(381, 103)) // Moto 4×1
    assertEquals(Layout.MEDIUM_QUICK, layout(381, 221)) // Moto 4×2: chips + budget
    assertEquals(Layout.MEDIUM_QUICK, layout(373, 204)) // Pixel 4×2
    assertEquals(Layout.MEDIUM, layout(373, 170)) // a 4×2 too short for chips keeps the budget
  }

  @Test
  fun `smaller than every layout falls back to the smallest, unknown to the default`() {
    assertEquals(Layout.TINY, layout(60, 30))
    assertEquals(Layout.MEDIUM, layout(0, 0))
  }

  @Test
  fun `every layout is reachable and none needs more than the widget may grow to`() {
    val reached = (40..420 step 4).flatMap { w -> (30..340 step 4).map { h -> layout(w, h) } }.toSet()
    assertEquals(Layout.entries.toSet(), reached)
    // zero_widget_info.xml: maxResizeWidth 420dp, maxResizeHeight 340dp.
    assertTrue(Layout.entries.all { it.minWidth <= 420f && it.minHeight <= 340f })
  }

  @Test
  fun `chips keep their natural width and only whole chips are shown`() {
    // Moto 4×3 row: 381 − 32 = 349 dp. Food, Grocery, Transportation, Fuel at 13 sp ≈ 30/50/94/27 dp.
    val names = listOf(30f, 50f, 94f, 27f)
    // 50 + 6+70 + 6+114 + 6+47 = 299: all four fit.
    assertEquals(4, WidgetRenderer.chipsThatFit(names, 349f))
    // Pixel-like 4×2 narrowed to 260 dp: the fourth would not fit whole.
    assertEquals(3, WidgetRenderer.chipsThatFit(names, 250f))
    assertEquals(2, WidgetRenderer.chipsThatFit(names, 200f))
  }

  @Test
  fun `a first chip too long for the row still shows ellipsized and no names give no chips`() {
    assertEquals(1, WidgetRenderer.chipsThatFit(listOf(400f, 20f), 349f))
    assertEquals(0, WidgetRenderer.chipsThatFit(emptyList(), 349f))
  }

  @Test
  fun `an add again amount reads as typed`() {
    assertEquals("20", WidgetRenderer.plainAmount(20.0))
    assertEquals("12.5", WidgetRenderer.plainAmount(12.5))
    assertEquals("1500000", WidgetRenderer.plainAmount(1_500_000.0))
  }
}
