package com.anotherwhy.zero.backup

import java.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The encrypted backup format, Android side (3.0, plan P10), against the
 * vectors Node's crypto wrote (contracts/backup-format.json; the iOS side
 * reads the same file): every case opens, every reject is refused with the
 * same answer, and a file this side writes carries the reference header and
 * opens again.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BackupFormatTest {
  private val contract: JSONObject by lazy {
    val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("backup-format.json")) {
      "backup-format.json missing from contracts/ (android/app/build.gradle test resources)"
    }
    JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
  }

  private fun objects(name: String): List<JSONObject> {
    val array: JSONArray = contract.getJSONArray(name)
    return (0 until array.length()).map(array::getJSONObject)
  }

  private fun hex(value: String): ByteArray = ByteArray(value.length / 2) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

  private fun bytes(base64: String): ByteArray = Base64.getDecoder().decode(base64)

  @Test
  fun `derives the reference key for every case, NFC and 600,000 iterations included`() {
    for (case in objects("cases")) {
      val key = BackupFormat.deriveKey(case.getString("openWith"), hex(case.getString("saltHex")), case.getInt("iterations"))
      assertArrayEquals(case.getString("name"), hex(case.getString("keyHex")), key)
    }
  }

  @Test
  fun `opens every file the reference wrote`() {
    for (case in objects("cases")) {
      val text = BackupFormat.open(bytes(case.getString("fileBase64")), case.getString("openWith")).toString(Charsets.UTF_8)
      assertEquals(case.getString("name"), case.getString("plaintext"), text)
    }
  }

  @Test
  fun `refuses every reject with the reference's answer`() {
    for (reject in objects("rejects")) {
      try {
        BackupFormat.open(bytes(reject.getString("fileBase64")), reject.getString("passphrase"))
        fail("${reject.getString("name")} opened")
      } catch (e: BackupFormatException) {
        assertEquals(reject.getString("name"), reject.getString("error"), e.code)
      }
    }
  }

  @Test
  fun `writes the reference header, and what it writes opens again`() {
    for (case in objects("cases")) {
      val salt = hex(case.getString("saltHex"))
      val file =
          BackupFormat.seal(
              case.getString("plaintext").toByteArray(Charsets.UTF_8),
              hex(case.getString("keyHex")),
              salt,
              case.getInt("iterations"),
              case.getLong("writtenAtMs"),
              hex(case.getString("nonceHex")),
          )
      assertArrayEquals(case.getString("name"), hex(case.getString("headerHex")), file.copyOfRange(0, BackupFormat.HEADER_BYTES))
      assertEquals(case.getString("plaintext"), BackupFormat.open(file, case.getString("passphrase")).toString(Charsets.UTF_8))
      assertEquals(case.getLong("writtenAtMs"), BackupFormat.writtenAtMs(file))
    }
  }

  @Test
  fun `each file gets its own nonce and salt`() {
    val key = ByteArray(BackupFormat.KEY_BYTES)
    val salt = BackupFormat.randomSalt()
    val a = BackupFormat.seal("{}".toByteArray(), key, salt, 1_000, 0)
    val b = BackupFormat.seal("{}".toByteArray(), key, salt, 1_000, 0)
    assertEquals(false, a.copyOfRange(38, 50).contentEquals(b.copyOfRange(38, 50)))
    assertEquals(false, BackupFormat.randomSalt().contentEquals(BackupFormat.randomSalt()))
    assertNull(BackupFormat.writtenAtMs("{}".toByteArray()))
  }
}

/** Which files the folder keeps after a write (docs/BACKUP_FORMAT.md, "Files in the folder"). */
class BackupFilesTest {
  @Test
  fun `keeps the newest days, removes partial files, never touches anything else`() {
    val names =
        listOf(
            "zero-backup-2026-11-09.zbak",
            "zero-backup-2026-11-11.zbak",
            "zero-backup-2026-11-10.zbak",
            "zero-backup-2026-11-08.partial",
            "zero-backup-2026-11-07 (1).partial",
            "zero-backup-2026-11-06.replaced",
            "zero-backup-2026-11-11 (1).zbak",
            "holiday.jpg",
            "zero_v6_20261101.json",
        )
    assertEquals(
        listOf(
            "zero-backup-2026-11-09.zbak",
            "zero-backup-2026-11-08.partial",
            "zero-backup-2026-11-07 (1).partial",
            "zero-backup-2026-11-06.replaced",
        ),
        BackupFiles.toDelete(names, 2))
    assertEquals(3, BackupFiles.toDelete(names, 14).size)
    // Never everything: at least the newest stays, whatever `keep` says.
    assertEquals(2, BackupFiles.toDelete(names, 0).count(BackupFiles::isBackup))
  }

  @Test
  fun `names a day's file and its partial`() {
    assertEquals("zero-backup-2026-11-11.zbak", BackupFiles.fileName("2026-11-11"))
    assertEquals("zero-backup-2026-11-11.partial", BackupFiles.partialName("2026-11-11"))
    try {
      BackupFiles.fileName("../../x")
      fail("a path was accepted as a day")
    } catch (e: IllegalArgumentException) {
      // refused
    }
  }
}
