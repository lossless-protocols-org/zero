package com.anotherwhy.zero.backup

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** The backup key, with the salt and iteration count every file names. */
class StoredKey(val key: ByteArray, val salt: ByteArray, val iterations: Int)

/**
 * Where the automatic backup's key lives on Android (3.0, plan P10): the key
 * derived from the passphrase, never the passphrase. It is stored wrapped
 * (AES-GCM) by a key that never leaves the Android Keystore. Its wrapped
 * bytes sit in this app's private preferences, which `allowBackup="false"`
 * keeps out of Google's device backup. Uninstalling removes both, so a
 * reinstall asks for the passphrase again.
 */
object BackupKey {
  private const val PREFS = "zero_backup"
  private const val ALIAS = "zero_backup_key_wrap"
  private const val KEYSTORE = "AndroidKeyStore"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun wrappingKey(): SecretKey {
    val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (store.getKey(ALIAS, null) as? SecretKey)?.let {
      return it
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
        KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build())
    return generator.generateKey()
  }

  private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun unb64(text: String?) = text?.let { Base64.decode(it, Base64.NO_WRAP) }

  /** Derives the key from `passphrase` with a new salt and keeps it; files written before keep their own salt. */
  fun setPassphrase(context: Context, passphrase: String) {
    val salt = BackupFormat.randomSalt()
    val key = BackupFormat.deriveKey(passphrase, salt, BackupFormat.ITERATIONS)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, wrappingKey())
    val wrapped = cipher.doFinal(key)
    // commit, not apply: the next call (a first backup) must find it, and a failure must be said.
    val stored =
        prefs(context)
            .edit()
            .putString("key", b64(wrapped))
            .putString("key_iv", b64(cipher.iv))
            .putString("salt", b64(salt))
            .putInt("iterations", BackupFormat.ITERATIONS)
            .commit()
    if (!stored) {
      throw IllegalStateException("the key could not be saved")
    }
  }

  /** The kept key, or null when there is none or it can no longer be unwrapped (a Keystore reset). */
  fun load(context: Context): StoredKey? {
    val prefs = prefs(context)
    val wrapped = unb64(prefs.getString("key", null)) ?: return null
    val iv = unb64(prefs.getString("key_iv", null)) ?: return null
    val salt = unb64(prefs.getString("salt", null)) ?: return null
    val iterations = prefs.getInt("iterations", 0)
    return try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, wrappingKey(), GCMParameterSpec(128, iv))
      StoredKey(cipher.doFinal(wrapped), salt, iterations)
    } catch (e: Exception) {
      // A key the Keystore can no longer open is no key: JS asks for the passphrase again.
      null
    }
  }

  fun clear(context: Context) {
    prefs(context).edit().remove("key").remove("key_iv").remove("salt").remove("iterations").commit()
  }
}
