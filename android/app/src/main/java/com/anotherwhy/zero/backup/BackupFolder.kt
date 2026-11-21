package com.anotherwhy.zero.backup

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import java.io.FileOutputStream
import java.io.IOException
import org.json.JSONObject

/** The folder could not be reached: deleted, moved, its card removed, or its grant taken back. */
class FolderLostException(message: String) : Exception(message)

/**
 * The folder the user picked for automatic backups (3.0, plan P10), through
 * the Storage Access Framework: a tree grant made persistable, so it lasts
 * across restarts without any storage permission.
 *
 * Only a folder on the phone itself (internal storage or an SD card, the
 * system's ExternalStorageProvider) is accepted (owner decision 2026-11-11). A
 * cloud provider's folder writes through that provider's own uploads and
 * placeholders, which repeated replacement does not survive reliably; zero
 * makes no network call either way.
 */
class BackupFolder(private val context: Context) {
  companion object {
    const val ON_DEVICE = "com.android.externalstorage.documents"
    private const val PREFS = "zero_backup"
    private const val FOLDER = "folder_uri"

    /** Where the picker opens: the phone's Documents folder (API 26+ reads it; earlier ignore it). */
    val INITIAL: Uri = DocumentsContract.buildDocumentUri(ON_DEVICE, "primary:Documents")
  }

  private val resolver = context.contentResolver
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun saved(): Uri? = prefs.getString(FOLDER, null)?.let(Uri::parse)

  /** Keeps `tree` if it is on the phone, releasing the folder chosen before; false when it is not on the phone. */
  fun choose(tree: Uri): Boolean {
    if (tree.authority != ON_DEVICE) {
      return false
    }
    val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    resolver.takePersistableUriPermission(tree, flags)
    saved()?.takeIf { it != tree }?.let(::release)
    prefs.edit().putString(FOLDER, tree.toString()).commit()
    return true
  }

  fun forget() {
    saved()?.let(::release)
    prefs.edit().remove(FOLDER).commit()
  }

  private fun release(tree: Uri) {
    try {
      resolver.releasePersistableUriPermission(
          tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    } catch (e: SecurityException) {
      // Already gone: nothing to release.
    }
  }

  /** "primary:Documents/zero" → phone, "Documents/zero"; "1234-ABCD:Backups" → SD card, "Backups". */
  private fun where(tree: Uri): Pair<String, String> {
    val id = DocumentsContract.getTreeDocumentId(tree)
    val volume = id.substringBefore(':')
    return (if (volume == "primary") "phone" else "sdCard") to id.substringAfter(':', "")
  }

  /** {state: none | ok | lost, volume?, path?, files?} for JS (src/data/backup/vault.ts). */
  fun describe(): JSONObject {
    val tree = saved() ?: return JSONObject().put("state", "none")
    val (volume, path) = where(tree)
    val out = JSONObject().put("volume", volume).put("path", path)
    return try {
      out.put("state", "ok").put("files", children(tree).keys.count(BackupFiles::isBackup))
    } catch (e: FolderLostException) {
      out.put("state", "lost")
    }
  }

  private fun granted(tree: Uri): Boolean =
      resolver.persistedUriPermissions.any { it.uri == tree && it.isWritePermission && it.isReadPermission }

  /** Name → document uri of every file directly in the folder. */
  private fun children(tree: Uri): Map<String, Uri> {
    if (!granted(tree)) {
      throw FolderLostException("the grant for the backup folder is gone")
    }
    val parentId = DocumentsContract.getTreeDocumentId(tree)
    val list = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId)
    val cursor =
        try {
          resolver.query(list, arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME), null, null, null)
        } catch (e: Exception) {
          // The provider throws when the folder no longer exists (deleted, card removed).
          throw FolderLostException("the backup folder cannot be listed: ${e.javaClass.simpleName}")
        } ?: throw FolderLostException("the backup folder cannot be listed")
    return cursor.use {
      buildMap {
        while (it.moveToNext()) {
          put(it.getString(1), DocumentsContract.buildDocumentUriUsingTree(tree, it.getString(0)))
        }
      }
    }
  }

  /**
   * Writes `bytes` as the day's backup, replacing an earlier one of that day,
   * then deletes what is past `keep`. The day's old file is never deleted
   * before the new one has its name: the new one is written and synced as a
   * partial, the old one is renamed aside, the partial takes the name, and only
   * then does the old one go. If the swap fails, the old one gets its name back.
   */
  fun write(day: String, bytes: ByteArray, keep: Int): String {
    val tree = saved() ?: throw FolderLostException("no backup folder")
    val finalName = BackupFiles.fileName(day)
    var before = children(tree)
    // A write cut short between setting the old file aside and naming the new one: the old one
    // gets its name back before anything else, so it is never the copy that is lost.
    val setAside = before[BackupFiles.replacedName(day)]
    if (setAside != null && before[finalName] == null) {
      DocumentsContract.renameDocument(resolver, setAside, finalName)
      before = children(tree)
    }
    // What is left now is never the only copy: an unnamed partial, or an old file whose day file exists.
    for (stale in listOf(BackupFiles.partialName(day), BackupFiles.replacedName(day))) {
      before[stale]?.let { DocumentsContract.deleteDocument(resolver, it) }
    }
    val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
    val partial =
        DocumentsContract.createDocument(resolver, parent, "application/octet-stream", BackupFiles.partialName(day))
            ?: throw FolderLostException("the backup folder refused a new file")
    val descriptor = resolver.openFileDescriptor(partial, "w") ?: throw IOException("could not open the new file")
    descriptor.use {
      FileOutputStream(it.fileDescriptor).use { stream ->
        stream.write(bytes)
        stream.flush()
        it.fileDescriptor.sync()
      }
    }
    val aside =
        before[finalName]?.let {
          DocumentsContract.renameDocument(resolver, it, BackupFiles.replacedName(day))
              ?: throw IOException("the old backup could not be set aside")
        }
    val renamed =
        try {
          DocumentsContract.renameDocument(resolver, partial, finalName)
        } catch (e: Exception) {
          null
        }
    if (renamed == null) {
      aside?.let { DocumentsContract.renameDocument(resolver, it, finalName) }
      throw IOException("the new backup could not take its name")
    }
    aside?.let { DocumentsContract.deleteDocument(resolver, it) }
    val after = children(tree)
    for (name in BackupFiles.toDelete(after.keys, keep)) {
      after[name]?.let {
        try {
          DocumentsContract.deleteDocument(resolver, it)
        } catch (e: Exception) {
          // An old file that will not go is left for the next write; the backup itself is made.
        }
      }
    }
    return finalName
  }
}
