# All settings

Settings marked ⟳ change the core's config: with the VPN on, the app reconnects by itself.

## Routing

| Setting | Default | |
| --- | --- | --- |
| Per-app routing | all apps | [more](/en/routing.md#per-app) |
| Bypass local network ⟳ | on | home devices without the VPN |
| Russian sites directly ⟳ | off | [presets](/en/routing.md#presets) |
| Block ads ⟳ | off | [presets](/en/routing.md#presets) |
| Update routing rules | — | downloads `geoip.dat` and `geosite.dat` again |

## DNS

| Setting | Default | |
| --- | --- | --- |
| Resolver ⟳ | Cloudflare | Cloudflare, Google or Quad9 |
| DNS over HTTPS ⟳ | off | encrypts DNS queries |
| IPv6 ⟳ | off | use IPv6 addresses |

## Connection

| Setting | Default | |
| --- | --- | --- |
| Chrome fingerprint for Reality ⟳ | on | see below |
| TLS fragmentation ⟳ | off | see below |
| Multiplexing (mux) ⟳ | off | see below |
| Test delays on start | on | measures every server when the app opens and the VPN is off |
| Update subscriptions on start | on | subscriptions older than 12 hours refresh on open |

**Chrome fingerprint for Reality.** Since Xray 26.9.8 a Reality server silently drops clients
that do not send X25519MLKEM768 in their ClientHello, as the `ios`, `edge`, `android` and
`random` fingerprints do. This setting switches the fingerprint to `chrome`, which sends it.
Leave it on unless you know why you would turn it off.

**TLS fragmentation.** The first TLS message, which carries the server name, is cut into small
pieces with pauses so DPI cannot read it whole. It helps when TLS servers are blocked by name.
It applies to TLS and Reality servers over TCP and does not affect Hysteria2.

**Multiplexing.** Many connections share one connection to the server, which speeds up page
loads on slow links. It is skipped for XTLS Vision, XHTTP and Hysteria2, which either do not
work with mux or do not need it.

## Appearance

| Setting | Options |
| --- | --- |
| Theme | System, Light, Dark, AMOLED (pure black, saves battery on OLED screens) |
| Colours | Ocean, Emerald, Pastel, Mono, the same presets as the We1ssBoard panel |
| Language | Русский or English; the app restarts |

## Updates and About

Shows the installed version and the Xray core version, with **Check for updates**
([more](/en/install.md#updating)).
