package com.anotherwhy.zero.backup

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.security.SecureRandom
import java.text.Normalizer
import java.util.zip.DataFormatException
import java.util.zip.Deflater
import java.util.zip.Inflater
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Why a file could not be opened; `code` is what JS receives (src/data/backup/vault.ts). */
class BackupFormatException(val code: String, message: String) : Exception(message)

/**
 * The encrypted backup file (3.0, plan P10), exactly as docs/BACKUP_FORMAT.md
 * describes it: compressed JSON sealed with AES-256-GCM under a key derived
 * from the passphrase with PBKDF2-HMAC-SHA256, the 50-byte header
 * authenticated with it. Tested against contracts/backup-format.json, which
 * the iOS side reads too.
 *
 * Pure: no Android API, so the JVM tests run it as the phone does.
 */
object BackupFormat {
  private val MAGIC = "ZEROBAK".toByteArray(Charsets.US_ASCII)
  private const val VERSION: Byte = 1
  private const val KDF_PBKDF2_SHA256: Byte = 1
  private const val COMPRESSION_RAW_DEFLATE: Byte = 1
  const val HEADER_BYTES = 50
  private const val TAG_BYTES = 16
  const val SALT_BYTES = 16
  private const val NONCE_BYTES = 12
  const val KEY_BYTES = 32
  /** What zero writes: OWASP's current figure for PBKDF2-HMAC-SHA256. */
  const val ITERATIONS = 600_000
  private const val MIN_ITERATIONS = 1_000
  private const val MAX_ITERATIONS = 10_000_000
  private const val MAX_INFLATED_BYTES = 256L * 1024 * 1024

  private val random = SecureRandom()

  fun randomSalt(): ByteArray = ByteArray(SALT_BYTES).also(random::nextBytes)

  /**
   * PBKDF2-HMAC-SHA256 over the UTF-8 of the NFC passphrase, one 32-byte block.
   * Written out over `Mac` rather than `SecretKeyFactory`: Android has
   * PBKDF2WithHmacSHA256 only from API 26 (zero supports 24), and one path on
   * every version is one path to test. The vectors include 600,000 iterations.
   */
  fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): ByteArray {
    val password = Normalizer.normalize(passphrase, Normalizer.Form.NFC).toByteArray(Charsets.UTF_8)
    val mac = Mac.getInstance("HmacSHA256")
    // SecretKeySpec refuses an empty key. HMAC pads its key with zeros, so one zero byte is the
    // same key as none. JS refuses a short passphrase before this; the line only keeps it total.
    mac.init(SecretKeySpec(if (password.isEmpty()) ByteArray(1) else password, "HmacSHA256"))
    mac.update(salt)
    mac.update(byteArrayOf(0, 0, 0, 1))
    val u = mac.doFinal()
    val out = u.copyOf()
    for (i in 1 until iterations) {
      mac.update(u)
      mac.doFinal(u, 0)
      for (j in out.indices) {
        out[j] = (out[j].toInt() xor u[j].toInt()).toByte()
      }
    }
    return out
  }

  private fun header(salt: ByteArray, iterations: Int, writtenAtMs: Long, nonce: ByteArray): ByteArray =
      ByteBuffer.allocate(HEADER_BYTES)
          .put(MAGIC)
          .put(VERSION)
          .put(KDF_PBKDF2_SHA256)
          .putInt(iterations)
          .put(salt)
          .put(COMPRESSION_RAW_DEFLATE)
          .putLong(writtenAtMs)
          .put(nonce)
          .array()

  /** A file: `plaintext` compressed and sealed under `key`, whose salt and iterations the header names. */
  fun seal(
      plaintext: ByteArray,
      key: ByteArray,
      salt: ByteArray,
      iterations: Int,
      writtenAtMs: Long,
      nonce: ByteArray = ByteArray(NONCE_BYTES).also(random::nextBytes),
  ): ByteArray {
    require(key.size == KEY_BYTES && salt.size == SALT_BYTES && nonce.size == NONCE_BYTES)
    val head = header(salt, iterations, writtenAtMs, nonce)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BYTES * 8, nonce))
    cipher.updateAAD(head)
    // doFinal appends the tag, as the format has it.
    return head + cipher.doFinal(deflate(plaintext))
  }

  /** The JSON inside a file, or a BackupFormatException naming why not (the order of docs/BACKUP_FORMAT.md "Reading"). */
  fun open(file: ByteArray, passphrase: String): ByteArray {
    if (file.size < HEADER_BYTES + TAG_BYTES || !file.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) {
      throw BackupFormatException("notBackup", "not a zero backup")
    }
    if (file[7] != VERSION || file[8] != KDF_PBKDF2_SHA256 || file[29] != COMPRESSION_RAW_DEFLATE) {
      throw BackupFormatException("newerFormat", "made by a newer zero")
    }
    val iterations = ByteBuffer.wrap(file, 9, 4).int
    if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
      throw BackupFormatException("notBackup", "iterations out of range")
    }
    val key = deriveKey(passphrase, file.copyOfRange(13, 29), iterations)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BYTES * 8, file, 38, NONCE_BYTES))
    cipher.updateAAD(file, 0, HEADER_BYTES)
    val compressed =
        try {
          cipher.doFinal(file, HEADER_BYTES, file.size - HEADER_BYTES)
        } catch (e: AEADBadTagException) {
          throw BackupFormatException("wrongPassphrase", "the tag did not match")
        }
    return inflate(compressed)
  }

  /** When the file says it was written; null when the header is not a zero backup's. */
  fun writtenAtMs(file: ByteArray): Long? =
      if (file.size >= HEADER_BYTES && file.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) {
        ByteBuffer.wrap(file, 30, 8).long
      } else {
        null
      }

  private fun deflate(input: ByteArray): ByteArray {
    // nowrap: raw DEFLATE, no zlib header (iOS's Compression framework reads and writes this).
    val deflater = Deflater(Deflater.DEFAULT_COMPRESSION, true)
    try {
      deflater.setInput(input)
      deflater.finish()
      val out = ByteArrayOutputStream(maxOf(64, input.size / 4))
      val buffer = ByteArray(64 * 1024)
      while (!deflater.finished()) {
        out.write(buffer, 0, deflater.deflate(buffer))
      }
      return out.toByteArray()
    } finally {
      deflater.end()
    }
  }

  private fun inflate(input: ByteArray): ByteArray {
    val inflater = Inflater(true)
    try {
      inflater.setInput(input)
      val out = ByteArrayOutputStream(input.size * 4)
      val buffer = ByteArray(64 * 1024)
      while (!inflater.finished()) {
        val n = inflater.inflate(buffer)
        if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) {
          throw BackupFormatException("damaged", "the compressed data ended early")
        }
        out.write(buffer, 0, n)
        if (out.size() > MAX_INFLATED_BYTES) {
          throw BackupFormatException("damaged", "larger than any backup")
        }
      }
      return out.toByteArray()
    } catch (e: DataFormatException) {
      throw BackupFormatException("damaged", "the compressed data is not valid")
    } finally {
      inflater.end()
    }
  }
}
