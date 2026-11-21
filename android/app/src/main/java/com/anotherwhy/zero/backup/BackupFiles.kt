package com.anotherwhy.zero.backup

/**
 * Which files in the backup folder are zero's, and which of them to delete
 * after a write (docs/BACKUP_FORMAT.md, "Files in the folder"). Pure, so both
 * the rules and the iOS twin's are tested on names alone.
 */
object BackupFiles {
  private val BACKUP = Regex("""^zero-backup-(\d{4}-\d{2}-\d{2})\.zbak$""")
  /** What a write leaves only if it was cut short: its partial or the day's old file set aside, " (1)" copies included. */
  private val LEFTOVER = Regex("""^zero-backup-(\d{4}-\d{2}-\d{2})( \(\d+\))?\.(partial|replaced)$""")

  fun fileName(day: String): String {
    require(Regex("""^\d{4}-\d{2}-\d{2}$""").matches(day)) { "day must be YYYY-MM-DD" }
    return "zero-backup-$day.zbak"
  }

  fun partialName(day: String): String = fileName(day).removeSuffix(".zbak") + ".partial"

  fun replacedName(day: String): String = fileName(day).removeSuffix(".zbak") + ".replaced"

  fun isBackup(name: String): Boolean = BACKUP.matches(name)

  /**
   * After a successful write: every backup but the newest `keep` (by the day in
   * its name), and anything an earlier write left when it did not finish.
   * Names that are not zero's are never in the list.
   */
  fun toDelete(names: Collection<String>, keep: Int): List<String> {
    val backups = names.filter(BACKUP::matches).sortedDescending()
    return backups.drop(maxOf(1, keep)) + names.filter(LEFTOVER::matches)
  }
}
