# The encrypted backup file (`.zbak`)

zero 3.0 (plan P10) writes its automatic backups in this format. Android
(`android/app/src/main/java/com/anotherwhy/zero/backup/BackupFormat.kt`) and iOS
(`ios/ZeroBackup/BackupFormat.swift`) both implement it. The test reference
(`__tests__/harness/backupFormatReference.ts`, Node's own crypto) writes the
shared vectors in `contracts/backup-format.json`, and both platforms are tested
against that same file. A file written on one phone opens on the other.

Inside the file is the ordinary backup: the same JSON envelope (`{key, version,
data}`) that Settings → Export writes and the importer reads. Encryption wraps
that JSON. It does not change the JSON. The restore path decrypts the file, then
treats the result exactly like a `.json` backup: validate, upgrade, import.

## Layout

All integers are big-endian.

| Offset | Size | Field                                                                      |
| -----: | ---: | -------------------------------------------------------------------------- |
|      0 |    7 | Magic: ASCII `ZEROBAK` (`5A 45 52 4F 42 41 4B`)                            |
|      7 |    1 | Format version: `1`                                                        |
|      8 |    1 | Key derivation: `1` = PBKDF2-HMAC-SHA256                                   |
|      9 |    4 | Iterations (u32). Writers use 600,000                                      |
|     13 |   16 | Salt                                                                       |
|     29 |    1 | Compression: `1` = raw DEFLATE (RFC 1951, no zlib or gzip header)          |
|     30 |    8 | Written at: milliseconds since 1970-01-01 UTC (u64)                        |
|     38 |   12 | Nonce                                                                      |
|     50 |    n | AES-256-GCM ciphertext of the compressed JSON, followed by its 16-byte tag |

The 50 header bytes are the GCM additional authenticated data. A header changed
by one bit fails the tag, like a changed ciphertext.

## Key

`key = PBKDF2-HMAC-SHA256(password = UTF-8(NFC(passphrase)), salt, iterations, 32 bytes)`

- The passphrase is normalised to Unicode NFC first. "é" typed as one character or as
  "e" plus an accent gives the same key on every keyboard and platform.
- The 600,000 iterations follow OWASP's current figure for PBKDF2-HMAC-SHA256.
  Argon2id would need a library on both platforms. PBKDF2 is built into both.
- The phone keeps the derived key, never the passphrase. On Android it is
  wrapped by an Android Keystore key; on iOS it is in the Keychain,
  `AfterFirstUnlockThisDeviceOnly`. It keeps the salt and the iteration count
  next to the key. Every file it writes carries them, so the passphrase alone
  opens any file on any phone. A changed passphrase gives a new salt and a new
  key. Files written before the change still need the old passphrase.
- Each file has a fresh random 96-bit nonce. A phone writes a few files a day
  under one key, which is far below the bound where random GCM nonces become a
  concern.

## Reading

A reader checks, in this order, and stops at the first failure:

1. At least 66 bytes (header and tag), and the magic: otherwise **not a backup**.
2. Version `1`, key derivation `1`, compression `1`: otherwise **made by a newer zero**.
3. Iterations between 1,000 and 10,000,000. Outside that range the file is **not a
   backup**. The upper bound stops a crafted file from occupying the phone for
   minutes.
4. Derive the key, then open with GCM and the header as additional data. A tag
   failure is **wrong passphrase**. The same failure covers a damaged file: GCM
   cannot tell the two apart, and the message says both.
5. Inflate, stopping at 256 MiB of output: otherwise **damaged**. A file that
   passed the tag was written by zero, so this guards against a zero bug, not
   an attacker.
6. The result is UTF-8 JSON, handed to the normal import (validator, upgrader,
   importer).

Only after step 4 does anything read the file's content. A wrong passphrase is
found before the JSON is parsed.

## Files in the folder

- A backup is named `zero-backup-YYYY-MM-DD.zbak`, after the phone's local day.
  A later backup on the same day replaces that day's file. The folder keeps the
  newest N days (7, 14 or 30, default 14), and zero deletes older files it wrote.
  It never touches a file whose name does not match this pattern.
- The replacement never leaves a half-written file under the final name.
  - Android writes and syncs `zero-backup-YYYY-MM-DD.partial`, renames the day's
    old file to `….replaced`, renames the partial to the final name, and only
    then deletes the old file. If the swap fails, the old file gets its name
    back. A write that finds a `.replaced` with no day file renames it back first.
    So the day's old file is never deleted before the new one has its name.
  - iOS writes through `NSFileCoordinator` with an atomic write.
- Pruning runs only after a successful write, and removes anything an interrupted
  write left (`.partial`, `.replaced`, and their " (1)" copies).
