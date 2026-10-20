package com.we1bschatten.xrayvpn

import libXray.LibXray
import org.json.JSONObject

// Thin wrapper over libXray's JSON "invoke" API (github.com/XTLS/libXray, MIT).
object XrayCore {
  private const val API_VERSION = 3

  class XrayException(message: String) : Exception(message)

  /** Calls a libXray method and returns its "data" field, or throws its error. */
  fun call(method: String, payload: JSONObject? = null): Any? {
    val request = JSONObject().put("apiVersion", API_VERSION).put("method", method)
    if (payload != null) request.put("payload", payload)
    val response = JSONObject(LibXray.invoke(request.toString()))
    if (!response.optBoolean("success")) {
      throw XrayException(response.optString("error").ifEmpty { "$method failed" })
    }
    return if (response.isNull("data")) null else response.get("data")
  }

  fun version(): String = (call("xrayVersion") as JSONObject).optString("version")

  /** Share links, a base64 subscription or an Xray JSON document → Xray JSON with outbounds. */
  fun convertShareLinks(text: String): String =
    call("convertShareLinksToXrayJson", JSONObject().put("text", text)).toString()

  fun run(xrayJson: String) {
    call("runXray", JSONObject().put("xrayJson", xrayJson))
  }

  fun stop() {
    call("stopXray")
  }

  fun isRunning(): Boolean =
    (call("getXrayState") as? JSONObject)?.optBoolean("running") ?: false

  /** Measures the delay through each config's outbound; -1 for failures. */
  fun ping(configs: List<String>, url: String, timeoutSeconds: Int): List<Long> {
    val items = org.json.JSONArray()
    configs.forEach { items.put(JSONObject().put("xrayJson", it).put("outboundTag", "proxy")) }
    val data = call(
      "pingBatch",
      JSONObject().put("configs", items).put("url", url).put("timeout", timeoutSeconds),
    ) as JSONObject
    val results = data.optJSONArray("results") ?: return configs.map { -1L }
    return (0 until results.length()).map {
      val r = results.getJSONObject(it)
      if (r.optBoolean("success")) r.optLong("delay") else -1L
    }
  }
}
