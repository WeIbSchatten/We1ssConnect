package com.we1bschatten.xrayvpn

import android.app.Activity
import android.content.Intent
import android.os.Bundle

// A long press on the quick settings tile opens this; it hands over to the app itself
// instead of the system's app info screen.
class TilePreferencesActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    packageManager.getLaunchIntentForPackage(packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      ?.let { startActivity(it) }
    finish()
  }
}
