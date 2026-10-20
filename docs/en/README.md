<div class="hero">
  <img src="assets/logo.svg" alt="We1ssConnect">
  <h1>We1ssConnect</h1>
  <p>A fast, tidy VPN client for Android on the Xray core</p>
  <a class="btn" href="https://github.com/WeIbSchatten/We1ssConnect/releases/latest">Download APK</a>
  <a class="btn ghost" href="#/en/quickstart">First connection</a>
</div>

We1ssConnect is a client for Xray-core servers, made first of all for the
[We1ssBoard](https://github.com/WeIbSchatten/We1ssBoard) panel. It connects with a subscription
or share links, picks the fastest server by itself, shows which country you exit through, and
lets you decide which apps use the VPN.

<div class="features">
  <div><b>Xray core</b><span>VLESS (Reality, Vision, XHTTP), VMess, Trojan, Shadowsocks and Hysteria2. The core runs inside the app, with no tun2socks and no local ports.</span></div>
  <div><b>Ping before and during</b><span>Every server's delay is tested before you connect and stays live while the VPN is on.</span></div>
  <div><b>Automatic choice</b><span>The balancer takes the lowest-delay server or rotates through live servers, and steps around a server that stops answering.</span></div>
  <div><b>Your IP and country</b><span>Home shows the exit IP (middle hidden), country flag, city and ISP, plus speed and session traffic.</span></div>
  <div><b>Per-app routing</b><span>All apps, only the chosen ones, or all except the chosen ones go through the VPN.</span></div>
  <div><b>Presets for Russia</b><span>Russian sites can go direct and ads can be blocked. The rule files download themselves.</span></div>
  <div><b>Against blocking</b><span>TLS fragmentation, mux, the Reality fix for Xray 26.9.8+, DNS over HTTPS and IPv6.</span></div>
  <div><b>Convenience</b><span>QR code import, a quick settings tile, subscription auto-update, in-app updates.</span></div>
  <div><b>Looks</b><span>Dark, light and AMOLED themes, the We1ssBoard panel colours, Russian and English.</span></div>
</div>

## Getting started

1. [Install the app](/en/install.md): download the APK from the release page.
2. [Add servers](/en/quickstart.md): a subscription link from the panel, share links or a QR code.
3. Tap the big button on the home screen.

## Requirements

| | |
| --- | --- |
| Android | 8.0 or newer |
| CPU | ARM64 (nearly all phones) or ARMv7 (older models) |
| Storage | up to 100 MB |
| Permissions | VPN, notifications; camera only for QR codes |

> We1ssConnect is free. Its core is [Xray-core](https://github.com/XTLS/Xray-core) (MPL-2.0)
> and [libXray](https://github.com/XTLS/libXray) (MIT); see
> [NOTICE.md](https://github.com/WeIbSchatten/We1ssConnect/blob/main/NOTICE.md).
