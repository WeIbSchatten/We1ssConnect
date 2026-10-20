package com.we1bschatten.xrayvpn

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.FileProvider
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.VpnService
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
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

    Events("onStatus", "onDownload")

    OnCreate { XrayVpnService.addListener(statusListener) }
    OnDestroy { XrayVpnService.removeListener(statusListener) }

    Function("status") {
      mapOf("state" to XrayVpnService.state.name.lowercase(), "error" to XrayVpnService.lastError)
    }

    AsyncFunction("xrayVersion") { XrayCore.version() }

    AsyncFunction("convertShareLinks") { text: String -> XrayCore.convertShareLinks(text) }

    AsyncFunction("shareLinks") { xrayJson: String -> XrayCore.shareLinks(xrayJson) }

    // Downloads the rule files for the routing presets; resolves with their time.
    AsyncFunction("downloadGeo") { files: Map<String, String> ->
      val dir = XrayVpnService.geoDir(context).apply { mkdirs() }
      files.forEach { (name, url) -> download(url, File(dir, name)) }
      geoUpdatedAt()
    }

    Function("geoUpdatedAt") { geoUpdatedAt() }

    /** The device's preferred ABI, to pick the matching APK of a release. */
    Function("abi") { Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a" }

    // Downloads an APK of a new version and opens the system installer for it.
    AsyncFunction("installUpdate") { url: String ->
      val dir = File(context.cacheDir, "updates").apply { mkdirs() }
      dir.listFiles()?.forEach { it.delete() }
      val apk = File(dir, "we1ssconnect-update.apk")
      download(url, apk) { done, total -> sendEvent("onDownload", mapOf("done" to done, "total" to total)) }
      val uri = FileProvider.getUriForFile(context, context.packageName + ".xrayvpn.files", apk)
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

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

  private fun geoUpdatedAt(): Double {
    val dir = XrayVpnService.geoDir(context)
    val files = listOf(File(dir, "geoip.dat"), File(dir, "geosite.dat"))
    return if (files.all { it.isFile && it.length() > 0 }) files.minOf { it.lastModified() }.toDouble() else 0.0
  }

  // The app is outside the tunnel, so this goes direct whether or not the VPN runs.
  private fun download(url: String, target: File, progress: ((Double, Double) -> Unit)? = null) {
    val tmp = File(target.parentFile, target.name + ".part")
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 15_000
    conn.readTimeout = 60_000
    conn.instanceFollowRedirects = true
    try {
      if (conn.responseCode != 200) throw CodedException("ERR_DOWNLOAD", "HTTP ${conn.responseCode} for $url", null)
      val total = conn.contentLengthLong.toDouble()
      conn.inputStream.use { input ->
        tmp.outputStream().use { out ->
          val buffer = ByteArray(64 * 1024)
          var done = 0L
          var reported = 0L
          while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            done += n
            // About every 512 KB, so the bridge is not flooded.
            if (progress != null && done - reported >= 512 * 1024) {
              reported = done
              progress(done.toDouble(), total)
            }
          }
          progress?.invoke(done.toDouble(), total)
        }
      }
      if (tmp.length() == 0L) throw CodedException("ERR_DOWNLOAD", "empty file from $url", null)
      if (!tmp.renameTo(target)) throw CodedException("ERR_DOWNLOAD", "cannot save ${target.name}", null)
    } finally {
      conn.disconnect()
      tmp.delete()
    }
  }

  private fun prefs() = context.getSharedPreferences("we1ssconnect", Context.MODE_PRIVATE)

  companion object {
    private const val VPN_REQUEST_CODE = 0x5650
  }
}
