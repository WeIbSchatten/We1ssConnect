package com.we1bschatten.xrayvpn

import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.VpnService
import android.util.Base64
import java.io.ByteArrayOutputStream
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

    Function("start") { config: String, title: String, target: String, appMode: String, apps: List<String> ->
      XrayVpnService.start(context, XrayVpnService.Request(config, target, appMode, apps), title)
    }

    // Live data from the running instance; each throws when nothing runs.
    AsyncFunction("observation") { XrayCore.observation() }
    AsyncFunction("balancerTarget") { XrayCore.balancerTarget(XrayVpnService.BALANCER) }
    AsyncFunction("setTarget") { target: String -> XrayCore.setBalancerTarget(XrayVpnService.BALANCER, target) }
    AsyncFunction("traffic") { XrayCore.traffic() }
    AsyncFunction("httpGet") { url: String, timeoutMs: Int -> XrayCore.httpGet(url, "", timeoutMs) }
    AsyncFunction("delay") { url: String, outboundTag: String, timeoutMs: Int ->
      XrayCore.delay(url, outboundTag, timeoutMs)
    }

    // Apps that can be routed one by one: everything with a launcher entry or INTERNET.
    AsyncFunction("installedApps") {
      val pm = context.packageManager
      pm.getInstalledApplications(PackageManager.GET_META_DATA)
        .filter { it.packageName != context.packageName }
        .filter {
          pm.getLaunchIntentForPackage(it.packageName) != null ||
            pm.checkPermission(android.Manifest.permission.INTERNET, it.packageName) == PackageManager.PERMISSION_GRANTED
        }
        .map {
          mapOf(
            "id" to it.packageName,
            "name" to pm.getApplicationLabel(it).toString(),
            "system" to ((it.flags and ApplicationInfo.FLAG_SYSTEM) != 0),
          )
        }
        .sortedBy { (it["name"] as String).lowercase() }
    }

    // A small PNG data URI of the app's icon, or null.
    AsyncFunction("appIcon") { packageName: String ->
      try {
        val drawable = context.packageManager.getApplicationIcon(packageName)
        val size = 96
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
      } catch (_: Exception) {
        null
      }
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
