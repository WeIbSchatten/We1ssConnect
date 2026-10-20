package com.we1bschatten.xrayvpn

import android.app.Activity
import android.content.Context
import android.net.VpnService
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class XrayVpnModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "React context is gone", null)

  private var permissionPromise: Promise? = null

  private val statusListener: (XrayVpnService.State, String?) -> Unit = { state, error ->
    sendEvent("onStatus", mapOf("state" to state.name.lowercase(), "error" to error))
  }

  override fun definition() = ModuleDefinition {
    Name("XrayVpn")

    Events("onStatus")

    OnCreate { XrayVpnService.addListener(statusListener) }
    OnDestroy { XrayVpnService.removeListener(statusListener) }

    Function("status") {
      mapOf("state" to XrayVpnService.state.name.lowercase(), "error" to XrayVpnService.lastError)
    }

    AsyncFunction("xrayVersion") { XrayCore.version() }

    AsyncFunction("convertShareLinks") { text: String -> XrayCore.convertShareLinks(text) }

    AsyncFunction("ping") { configs: List<String>, url: String, timeoutSeconds: Int ->
      XrayCore.ping(configs, url, timeoutSeconds)
    }

    // Asks for the system VPN permission; resolves true once it is granted.
    AsyncFunction("prepare") { promise: Promise ->
      val intent = VpnService.prepare(context)
      if (intent == null) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(CodedException("ERR_NO_ACTIVITY", "No activity to ask for the VPN permission", null))
        return@AsyncFunction
      }
      permissionPromise?.resolve(false)
      permissionPromise = promise
      activity.runOnUiThread { activity.startActivityForResult(intent, VPN_REQUEST_CODE) }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != VPN_REQUEST_CODE) return@OnActivityResult
      permissionPromise?.resolve(payload.resultCode == Activity.RESULT_OK)
      permissionPromise = null
    }

    Function("start") { config: String, title: String ->
      XrayVpnService.start(context, config, title)
    }

    Function("stop") {
      XrayVpnService.stop(context)
    }

    // Small key-value store for profiles and settings (SharedPreferences).
    Function("getItem") { key: String ->
      prefs().getString(key, null)
    }

    Function("setItem") { key: String, value: String? ->
      prefs().edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }
  }

  private fun prefs() = context.getSharedPreferences("we1ssconnect", Context.MODE_PRIVATE)

  companion object {
    private const val VPN_REQUEST_CODE = 0x5650
  }
}
