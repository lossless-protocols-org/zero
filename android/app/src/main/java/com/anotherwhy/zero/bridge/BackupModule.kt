package com.anotherwhy.zero.bridge

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.provider.DocumentsContract
import android.util.Base64
import com.anotherwhy.zero.backup.BackupFolder
import com.anotherwhy.zero.backup.BackupFormat
import com.anotherwhy.zero.backup.BackupFormatException
import com.anotherwhy.zero.backup.BackupKey
import com.anotherwhy.zero.backup.FolderLostException
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * NativeBackup (3.0, plan P10): the encrypted backup for JS
 * (src/data/backup/vault.ts). Key derivation, encryption and the folder's
 * file work run on one background thread, one call after another, so two
 * backups never write the same folder at once.
 */
class BackupModule(context: ReactApplicationContext) : NativeBackupSpec(context), ActivityEventListener {
  private companion object {
    const val PICK_FOLDER = 0x7a62
  }

  private val worker = Executors.newSingleThreadExecutor()
  private var picking: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    worker.shutdown()
    super.invalidate()
  }

  private val app get() = reactApplicationContext.applicationContext

  private fun work(promise: Promise, block: () -> Unit) {
    worker.execute {
      try {
        block()
      } catch (e: Exception) {
        // Never the passphrase or the data: the class and message name the failure only.
        promise.reject("failed", "backup: ${e.javaClass.simpleName}: ${e.message}", e)
      }
    }
  }

  override fun chooseFolder(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null || picking != null) {
      promise.reject("failed", "backup: no screen to show the folder picker on")
      return
    }
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
                Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, BackupFolder.INITIAL)
    }
    picking = promise
    try {
      activity.startActivityForResult(intent, PICK_FOLDER)
    } catch (e: Exception) {
      picking = null
      promise.reject("failed", "backup: the folder picker did not open: ${e.javaClass.simpleName}", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PICK_FOLDER) {
      return
    }
    val promise = picking ?: return
    picking = null
    val tree = data?.data
    if (resultCode != Activity.RESULT_OK || tree == null) {
      promise.resolve(JSONObject().put("outcome", "cancelled").toString())
      return
    }
    work(promise) {
      val outcome = if (BackupFolder(app).choose(tree)) "chosen" else "notOnDevice"
      promise.resolve(JSONObject().put("outcome", outcome).toString())
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun folder(promise: Promise) = work(promise) { promise.resolve(BackupFolder(app).describe().toString()) }

  override fun setPassphrase(passphrase: String, promise: Promise) =
      work(promise) {
        BackupKey.setPassphrase(app, passphrase)
        promise.resolve(null)
      }

  override fun write(json: String, day: String, keep: Double, promise: Promise) {
    worker.execute {
      val stored = BackupKey.load(app)
      if (stored == null) {
        promise.reject("noKey", "backup: no key is kept")
        return@execute
      }
      try {
        val file =
            BackupFormat.seal(
                json.toByteArray(Charsets.UTF_8), stored.key, stored.salt, stored.iterations, System.currentTimeMillis())
        val name = BackupFolder(app).write(day, file, keep.toInt())
        promise.resolve(JSONObject().put("fileName", name).put("bytes", file.size).toString())
      } catch (e: FolderLostException) {
        promise.reject("folderLost", "backup: ${e.message}", e)
      } catch (e: SecurityException) {
        promise.reject("folderLost", "backup: the folder's grant was refused", e)
      } catch (e: Exception) {
        promise.reject("failed", "backup: ${e.javaClass.simpleName}: ${e.message}", e)
      }
    }
  }

  override fun decrypt(base64: String, passphrase: String, promise: Promise) {
    worker.execute {
      try {
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        promise.resolve(BackupFormat.open(bytes, passphrase).toString(Charsets.UTF_8))
      } catch (e: BackupFormatException) {
        promise.reject(e.code, "backup: ${e.message}")
      } catch (e: IllegalArgumentException) {
        promise.reject("notBackup", "backup: the file is not base64")
      } catch (e: Exception) {
        promise.reject("damaged", "backup: ${e.javaClass.simpleName}", e)
      }
    }
  }

  override fun forget(promise: Promise) =
      work(promise) {
        BackupFolder(app).forget()
        BackupKey.clear(app)
        promise.resolve(null)
      }

  // Android keeps a backgrounded app's process running long enough to finish a write.
  override fun holdBackground(promise: Promise) = promise.resolve(0.0)

  override fun releaseBackground(token: Double, promise: Promise) = promise.resolve(null)
}
