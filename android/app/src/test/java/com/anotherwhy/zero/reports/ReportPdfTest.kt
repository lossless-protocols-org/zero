package com.anotherwhy.zero.reports

import android.graphics.Bitmap
import android.graphics.Canvas
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * PDF reports, Android side (3.0, plan P12), on the documents the JS builders
 * wrote (contracts/report-doc.json; the iOS side draws the same file): each
 * parses whole and draws, and a long one runs over several pages with ink on
 * each. The test runtime has no PDF writer, so the pages are bitmaps here:
 * the layout and drawing are the same code, and the file itself is checked
 * on the device walk. This proves no document the app can write breaks the
 * renderer.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ReportPdfTest {
  private val contract: JSONObject by lazy {
    val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("report-doc.json")) {
      "report-doc.json missing from contracts/ (android/app/build.gradle test resources)"
    }
    JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
  }

  private fun doc(name: String): ReportDoc = ReportDoc.parse(contract.getJSONObject(name).toString())

  /** Pages as bitmaps, kept so a test can look at what was drawn. */
  private class BitmapPages : ReportPdf.Pages {
    val bitmaps = mutableListOf<Bitmap>()

    override fun start(number: Int): Canvas {
      val bitmap = Bitmap.createBitmap(ReportPdf.PAGE_WIDTH, ReportPdf.PAGE_HEIGHT, Bitmap.Config.ARGB_8888)
      bitmaps += bitmap
      return Canvas(bitmap)
    }

    override fun finish() = Unit

    /** How many pixels of page [index] were drawn on. */
    fun ink(index: Int): Int {
      val bitmap = bitmaps[index]
      val pixels = IntArray(bitmap.width * bitmap.height)
      bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
      return pixels.count { it != 0 }
    }
  }

  private fun draw(document: ReportDoc): BitmapPages = BitmapPages().also { ReportPdf(document).drawOn(it) }

  @Test
  fun `reads every block the app writes`() {
    val spending = doc("spending")
    assertEquals("Spending report", spending.title)
    assertEquals("7 Nov – 6 Dec 2026", spending.subtitle)
    assertEquals(false, spending.rtl)
    assertEquals(
        listOf("Stats", "Text", "Text", "Heading", "Bars", "Table", "Heading", "Table"),
        spending.blocks.map { it.javaClass.simpleName },
    )
    val table = spending.blocks.filterIsInstance<ReportDoc.Table>().first()
    assertEquals(listOf("Category", "Amount", "Share"), table.columns.map { it.title })
    assertEquals(listOf(false, true, true), table.columns.map { it.end })
    assertEquals(listOf("Total", "₹5,560.3", ""), table.total)
    assertEquals(true, doc("rtl").rtl)
  }

  @Test
  fun `a block of a kind this build does not know is an error, never a missing section`() {
    val unknown = JSONObject(contract.getJSONObject("spending").toString())
    unknown.getJSONArray("blocks").put(JSONObject().put("type", "chart"))
    try {
      ReportDoc.parse(unknown.toString())
      fail("an unknown block was accepted")
    } catch (e: IllegalArgumentException) {
      assertTrue(e.message.orEmpty().contains("chart"))
    }
  }

  @Test
  fun `every pinned document draws on one page`() {
    for (name in listOf("spending", "trends", "rtl")) {
      val pages = draw(doc(name))
      assertEquals(name, 1, pages.bitmaps.size)
      assertTrue("$name drew nothing", pages.ink(0) > 2000)
    }
  }

  @Test
  fun `a long report runs over several pages, each with its table rows and its foot`() {
    val pages = draw(doc("long"))
    assertTrue("140 entries took ${pages.bitmaps.size} page(s)", pages.bitmaps.size in 3..8)
    for (index in pages.bitmaps.indices) {
      assertTrue("page ${index + 1} is nearly empty", pages.ink(index) > 2000)
    }
  }

  @Test
  fun `a right-to-left report is drawn from the other side`() {
    // The same document mirrored: its ink sits on the right half where the left-to-right one's sits on the left.
    val ltr = draw(doc("spending"))
    val rtl = draw(doc("rtl"))
    fun leftShare(pages: BitmapPages): Double {
      val bitmap = pages.bitmaps[0]
      var left = 0
      var all = 0
      for (yy in 40 until 120) {
        for (x in 0 until bitmap.width) {
          if (bitmap.getPixel(x, yy) != 0) {
            all += 1
            if (x < bitmap.width / 2) left += 1
          }
        }
      }
      return left.toDouble() / maxOf(all, 1)
    }
    assertTrue("title of the left-to-right page", leftShare(ltr) > 0.6)
    assertTrue("title of the right-to-left page", leftShare(rtl) < 0.4)
  }

  @Test
  fun `a fraction outside 0 to 1 and a missing cell are bounded, not a crash`() {
    val odd =
        JSONObject()
            .put("title", "t")
            .put("subtitle", "s")
            .put("footer", "f")
            .put("direction", "ltr")
            .put(
                "blocks",
                org.json.JSONArray(
                    """[{"type":"bars","rows":[{"label":"a","value":"1","fraction":7},{"label":"b","value":"2","fraction":-1}]},
                       {"type":"table","columns":[{"title":"A","align":"start","weight":0},{"title":"B","align":"end","weight":1}],"rows":[["only one cell"]]},
                       {"type":"table","columns":[],"rows":[["a cell with no column"]]},
                       {"type":"stats","items":[]}]"""))
    val parsed = ReportDoc.parse(odd.toString())
    assertEquals(listOf(1.0, 0.0), (parsed.blocks[0] as ReportDoc.Bars).rows.map { it.fraction })
    assertEquals(1, draw(parsed).bitmaps.size)
  }
}
