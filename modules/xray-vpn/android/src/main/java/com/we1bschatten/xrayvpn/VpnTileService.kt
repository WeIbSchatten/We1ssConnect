package com.we1bschatten.xrayvpn

import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

// Quick settings tile: connects with the last used servers and settings, or disconnects.
class VpnTileService : TileService() {
  private val listener: (XrayVpnService.State, String?) -> Unit = { _, _ -> refresh() }

  override fun onStartListening() {
    XrayVpnService.addListener(listener)
    refresh()
  }

  override fun onStopListening() {
    XrayVpnService.removeListener(listener)
  }

  override fun onClick() {
    when (XrayVpnService.state) {
      XrayVpnService.State.CONNECTED, XrayVpnService.State.CONNECTING -> XrayVpnService.stop(this)
      else -> {
        val last = XrayVpnService.lastRequest(this)
        // Without a saved connection or the VPN permission the app has to ask first.
        if (last == null || VpnService.prepare(this) != null) openApp()
        else XrayVpnService.start(this, last.first, last.second)
      }
    }
  }

  private fun openApp() {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startActivityAndCollapse(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE))
    } else {
      @Suppress("DEPRECATION", "StartActivityAndCollapseDeprecated")
      startActivityAndCollapse(launch)
    }
  }

  private fun refresh() {
    val tile = qsTile ?: return
    tile.state = when (XrayVpnService.state) {
      XrayVpnService.State.CONNECTED, XrayVpnService.State.CONNECTING -> Tile.STATE_ACTIVE
      else -> Tile.STATE_INACTIVE
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) tile.subtitle = XrayVpnService.title
    tile.updateTile()
  }
}
