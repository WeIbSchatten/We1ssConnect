package com.we1bschatten.xrayvpn

import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONArray

// Measures the round trip to each server's own address, without going through it.
object ServerPing {
  /** targetsJson: [{"host", "port", "udp"}]; returns ms per target, -1 when unreachable. */
  fun measure(targetsJson: String, timeoutMs: Int): List<Long> {
    val targets = JSONArray(targetsJson)
    val pool = Executors.newFixedThreadPool(minOf(16, maxOf(1, targets.length())))
    try {
      val jobs = (0 until targets.length()).map { i ->
        val t = targets.getJSONObject(i)
        pool.submit(Callable { one(t.getString("host"), t.optInt("port", 443), t.optBoolean("udp"), timeoutMs) })
      }
      return jobs.map {
        try {
          it.get(timeoutMs * 3L, TimeUnit.MILLISECONDS)
        } catch (_: Exception) {
          -1L
        }
      }
    } finally {
      pool.shutdownNow()
    }
  }

  private fun one(host: String, port: Int, udp: Boolean, timeoutMs: Int): Long = try {
    // Name resolution is not part of the delay to the server.
    val address = InetAddress.getByName(host)
    if (udp) icmp(address, timeoutMs) else tcp(address, port, timeoutMs)
  } catch (_: Exception) {
    -1L
  }

  // The best of two connects, so a slow first SYN (radio waking up) does not count.
  private fun tcp(address: InetAddress, port: Int, timeoutMs: Int): Long {
    var best = -1L
    repeat(2) {
      try {
        Socket().use { socket ->
          val start = System.nanoTime()
          socket.connect(InetSocketAddress(address, port), timeoutMs)
          val ms = (System.nanoTime() - start) / 1_000_000
          if (best < 0 || ms < best) best = ms
        }
      } catch (_: Exception) {
      }
    }
    return best
  }

  private fun icmp(address: InetAddress, timeoutMs: Int): Long {
    var best = -1L
    repeat(2) {
      val start = System.nanoTime()
      if (address.isReachable(timeoutMs)) {
        val ms = (System.nanoTime() - start) / 1_000_000
        if (best < 0 || ms < best) best = ms
      }
    }
    return best
  }
}
