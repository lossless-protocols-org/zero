package com.anotherwhy.zero.bridge

import android.content.ClipData
import android.content.Intent
import androidx.core.content.FileProvider
import com.anotherwhy.zero.reports.ReportDoc
import com.anotherwhy.zero.reports.ReportPdf
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File
import java.util.concurrent.Executors

/**
 * NativeReportPdf (3.0, plan P12): draws a report the app wrote as a PDF and
 * hands it to the system share sheet (src/pro/reportPdf.ts). The file lives
 * in the app's own cache, in `reports/`, which holds one report at a time;
 * another app can read it only through the one-time grant the share sheet
 * gives the app the user picks. zero sends it nowhere itself.
 */
class ReportPdfModule(context: ReactApplicationContext) : NativeReportPdfSpec(context) {
  private val worker = Executors.newSingleThreadExecutor()

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }

  private fun folder(): File = File(reactApplicationContext.cacheDir, "reports")

  override fun render(json: String, fileName: String, promise: Promise) {
    worker.execute {
      try {
        // A name, never a path: nothing outside the reports folder can be written.
        val name = File(fileName).name.takeIf { it.endsWith(".pdf") && it.length > 4 } ?: "report.pdf"
        val dir = folder()
        // One report at a time: the last one has been shared or abandoned.
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, name)
        ReportPdf(ReportDoc.parse(json)).writeTo(file)
        promise.resolve(file.absolutePath)
      } catch (e: Exception) {
        // The class and message name the failure; a report's figures are never in either.
        promise.reject("report", "report: ${e.javaClass.simpleName}: ${e.message}", e)
      }
    }
  }

  override fun share(path: String, title: String, promise: Promise) {
    try {
      val file = File(path).canonicalFile
      if (file.parentFile != folder().canonicalFile || !file.isFile) {
        promise.reject("report", "report: not a file this module made")
        return
      }
      val app = reactApplicationContext
      val uri = FileProvider.getUriForFile(app, "${app.packageName}.reports", file)
      val send =
          Intent(Intent.ACTION_SEND)
              .setType("application/pdf")
              .putExtra(Intent.EXTRA_STREAM, uri)
              .putExtra(Intent.EXTRA_TITLE, title)
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      // The chooser's preview reads the file through the clip's grant.
      send.clipData = ClipData.newRawUri(title, uri)
      val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      val activity = app.currentActivity
      if (activity != null) {
        activity.startActivity(chooser)
      } else {
        app.startActivity(chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("report", "report: ${e.javaClass.simpleName}: ${e.message}", e)
    }
  }
}
