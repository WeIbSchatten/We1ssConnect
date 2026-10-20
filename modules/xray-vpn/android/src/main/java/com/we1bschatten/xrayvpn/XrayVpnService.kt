package com.we1bschatten.xrayvpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject

// Owns the TUN interface and the Xray instance. Xray reads packets straight from
// the TUN through its own "tun" inbound, so there is no separate tun2socks layer.
class XrayVpnService : VpnService() {
  enum class State { DISCONNECTED, CONNECTING, CONNECTED, ERROR }

  companion object {
    private const val TAG = "We1ssConnect"
    private const val CHANNEL_ID = "vpn"
    private const val NOTIFICATION_ID = 1
    const val ACTION_START = "com.we1bschatten.xrayvpn.START"
    const val ACTION_STOP = "com.we1bschatten.xrayvpn.STOP"
    const val EXTRA_TITLE = "title"

    // Addresses of the TUN interface; DNS_ADDRESS is answered by Xray's DNS outbound.
    private const val TUN_ADDRESS4 = "172.19.0.1"
    private const val TUN_ADDRESS6 = "fdfe:dcba:9876::1"
    private const val DNS_ADDRESS = "172.19.0.2"
    private const val MTU = 1500

    /** Config waiting to be started; set right before ACTION_START. */
    @Volatile var pendingConfig: String? = null

    @Volatile var state: State = State.DISCONNECTED
      private set
    @Volatile var lastError: String? = null
      private set
    @Volatile var title: String? = null
      private set

    private val listeners = mutableSetOf<(State, String?) -> Unit>()

    fun addListener(listener: (State, String?) -> Unit) = synchronized(listeners) { listeners.add(listener) }
    fun removeListener(listener: (State, String?) -> Unit) = synchronized(listeners) { listeners.remove(listener) }

    private fun publish(next: State, error: String? = null) {
      state = next
      lastError = error
      val snapshot = synchronized(listeners) { listeners.toList() }
      snapshot.forEach { it(next, error) }
    }

    fun start(context: Context, config: String, title: String) {
      pendingConfig = config
      val intent = Intent(context, XrayVpnService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_TITLE, title)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun stop(context: Context) {
      context.startService(Intent(context, XrayVpnService::class.java).setAction(ACTION_STOP))
    }
  }

  private var tun: ParcelFileDescriptor? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        shutdown()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        title = intent.getStringExtra(EXTRA_TITLE)
        showNotification()
        val config = pendingConfig
        pendingConfig = null
        if (config == null) {
          fail("no config to start")
        } else {
          // Starting Xray resolves and dials, so keep it off the main thread.
          Thread({ connect(config) }, "xray-start").start()
        }
      }
    }
    return START_NOT_STICKY
  }

  @Synchronized
  private fun connect(config: String) {
    publish(State.CONNECTING)
    try {
      // Switching servers while connected restarts the core on a fresh TUN.
      stopCore()
      closeTun()
      val builder = Builder()
        .setSession(title ?: "We1ssConnect")
        .setMtu(MTU)
        .addAddress(TUN_ADDRESS4, 30)
        .addRoute("0.0.0.0", 0)
        .addAddress(TUN_ADDRESS6, 126)
        .addRoute("::", 0)
        .addDnsServer(DNS_ADDRESS)
        // Xray's own sockets bypass the tunnel, so its traffic to the server never loops.
        .addDisallowedApplication(packageName)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) builder.setMetered(false)
      val fd = builder.establish() ?: throw IllegalStateException("VPN permission was revoked")
      tun = fd

      val json = JSONObject(config)
      val env = json.optJSONObject("env") ?: JSONObject()
      env.put("xray.tun.fd", fd.fd.toString())
      json.put("env", env)
      XrayCore.run(json.toString())
      publish(State.CONNECTED)
      showNotification()
    } catch (e: Exception) {
      Log.e(TAG, "connect failed", e)
      fail(e.message ?: e.toString())
    }
  }

  private fun fail(message: String) {
    stopCore()
    closeTun()
    publish(State.ERROR, message)
    stopForegroundCompat()
    stopSelf()
  }

  @Synchronized
  private fun shutdown() {
    stopCore()
    closeTun()
    publish(State.DISCONNECTED)
    stopForegroundCompat()
    stopSelf()
  }

  private fun stopCore() {
    try {
      XrayCore.stop()
    } catch (e: Exception) {
      Log.w(TAG, "stop failed", e)
    }
  }

  private fun closeTun() {
    try {
      tun?.close()
    } catch (_: Exception) {
    }
    tun = null
  }

  override fun onRevoke() {
    // Another VPN app took over, or the user turned us off in system settings.
    shutdown()
  }

  override fun onDestroy() {
    if (state == State.CONNECTED || state == State.CONNECTING) shutdown()
    super.onDestroy()
  }

  private fun showNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "VPN", NotificationManager.IMPORTANCE_LOW),
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE)
    val stop = PendingIntent.getService(
      this,
      1,
      Intent(this, XrayVpnService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE,
    )
    val text = if (state == State.CONNECTED) "Connected" else "Connecting…"
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setContentTitle(title ?: "We1ssConnect")
      .setContentText(text)
      .setContentIntent(open)
      .setOngoing(true)
      .addAction(0, "Disconnect", stop)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(Service.STOP_FOREGROUND_REMOVE)
    else @Suppress("DEPRECATION") stopForeground(true)
  }
}
