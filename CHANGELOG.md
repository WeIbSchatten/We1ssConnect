# Changelog

The full history with details is in the documentation:
[русский](https://weibschatten.github.io/We1ssConnect/ru/docs/help/history/) ·
[English](https://weibschatten.github.io/We1ssConnect/docs/help/history/).

## 1.11.0

- Log in to the We1ssBoard client portal (panel 1.11.0+) with a login and password instead of a link: the app keeps only a device token, keys turned off in the portal leave the list, a signed-out device shows "Login needed" with Log in again, and deleting the group signs the device out. The desktop shows in the portal under the computer's name.

## 1.10.1

- Tablets and wide windows: the app rotates with the screen instead of running in a phone-sized window, and lays the home screen out in two columns in landscape.
- OpenWrt: the Routing page opens again when a rule stores its domains or subnets as a uci list, and the rule editor shows the chosen services, presets and group servers as checkboxes on every LuCI theme (it showed them as unticked switches on proton2025, and "null" under Matches).

## 1.10.0

- A connect button that shows its state in motion, Onest type, smoother controls.
- Background mode: on Android the VPN comes back by itself after the system kills the app (also as Always-on VPN) and Settings lifts battery restrictions; on the desktop closing the window keeps the VPN running in the tray.
- Ad blocking and "Russian sites directly" no longer break the connection when GitHub release downloads fail: rule files come from raw.githubusercontent.com, and without them the VPN connects and warns. Ads are also blocked in DNS. QR codes are read again in release builds.
- OpenWrt: sing-box no longer dies at start when GitHub is unreachable — the client downloads the lists itself, keeps them on flash and fetches missing ones through the tunnel; a pasted subscription URL becomes a subscription; the blocked-in-Russia rule is on after install; no hourly Xray download when it cannot fit on the flash.

## 1.9.3

- OpenWrt: REALITY servers on Xray 26.9.8+ panels work through a local Xray, downloaded on first use; Hysteria2, TUIC and WebSocket work against the panel's Xray; delay test results; a warning when selective mode sends nothing through the tunnel; translated LuCI warnings; diagnostics after podkop.

## 1.9.2

- geosite:/geoip: categories in routing rules on every client: "Own rules" (through VPN, directly, block) on Android and desktop, a Categories field on the router. The router reads the same data as runetfreedom .srs rule-sets, and the apps now take geosite.dat from runetfreedom too, so ru-blocked and the other Russian categories work everywhere.

## 1.9.1

- OpenWrt: other clients (podkop, Passwall, Passwall2, OpenClash, Nikki, https-dns-proxy) no longer block the install; installing and Connect stop the active ones and turn off their autostart instead of requiring their removal, and the overview says what was stopped.

## 1.9.0

- OpenWrt 24.10 and 25.12 client (`.ipk` and `.apk`) on the feed's sing-box: subscriptions and keys, the Auto balancer with pinning without a restart, routing by lists (community services, presets, domains, subnets, remote lists), global mode, per-device and VPN-interface rules, LuCI pages in Russian and English, one-line installer.
- New documentation site with search, in Russian and English, linked with the panel docs.
- Versions now follow the We1ssBoard panel's MAJOR.MINOR.

## 1.2.0

- Subscription screen: traffic, expiry, the panel page, copy link, refresh, servers.
- Telegram proxies from the subscription (Web Proxy, MTProto) open in Telegram from the app.
- Windows: country flags instead of letters; tab labels no longer cut off on the desktop.

## 1.1.0

- Desktop apps for Windows (installer) and Linux: the same screens, connected through the system proxy (SOCKS5 127.0.0.1:10808, HTTP 127.0.0.1:10809), in-app updates.
- One release now carries the APKs and the desktop builds.

## 1.0.1

- Delay measured to the server itself by default (TCP, ICMP for Hysteria2), also while connected; the full test through the server stays as an option.
- Dialogs and menus in the app's own style.
- Design closer to the panel: W mark, bordered cards, stats strip.

## 1.0.0

- Automatic server choice by lowest delay or round robin.
- Exit IP with its middle hidden (tap to show).
- Key groups; update and remove menus for groups and subscriptions.
- Russian by default, English switch; system, light, dark and AMOLED themes; panel colour presets.
- In-app updates from GitHub releases.
- Long-pressing the quick settings tile opens the app.
- Documentation site in Russian and English.

## 0.0.2 (test build)

- Tabs UI; live ping, automatic choice, speed, exit IP and country through an in-process bridge.
- Per-app routing; Russian-direct and ad-block presets; DNS, DoH, IPv6, TLS fragmentation, mux.
- QR import, copy share link, quick settings tile, subscription auto-update; per-ABI APKs.

## 0.0.1

- First build on Xray-core with subscriptions, share links and the Reality fix.
