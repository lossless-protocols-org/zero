package com.anotherwhy.zero.quickadd

import android.annotation.SuppressLint
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * "Add expense" in the Quick Settings shade (2.8): one tap from any screen to
 * the quick-add sheet. An action, not a toggle, so the tile stays inactive.
 * On a locked phone the user unlocks first: an amount is personal data.
 */
class QuickAddTileService : TileService() {

  override fun onStartListening() {
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      updateTile()
    }
  }

  override fun onClick() {
    if (isLocked) {
      unlockAndRun { open() }
    } else {
      open()
    }
  }

  // The Intent overload is the only one before Android 14; it is deprecated there, not removed.
  @SuppressLint("StartActivityAndCollapseDeprecated")
  private fun open() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startActivityAndCollapse(QuickAdd.pendingIntent(this, REQUEST_TILE))
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(QuickAdd.intent(this))
    }
  }

  private companion object {
    const val REQUEST_TILE = 40
  }
}
