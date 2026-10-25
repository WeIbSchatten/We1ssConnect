# We1ssConnect for OpenWrt — design

Status: approved 2026-10-25. First release: We1ssConnect 1.9.0.

## Goal

A router client that does what podkop and v2rayN do on OpenWrt 24.10 and 25.12, with the
balancer and look of the other We1ssConnect clients. Every LAN device gets the tunnel without
an app of its own.

## Decisions

| Topic | Decision |
| --- | --- |
| Core | Stock `sing-box` from the OpenWrt feed (24.10: 1.12.x, 25.12: 1.13.x). No custom build. |
| Not available | XHTTP links and the round-robin balancer: stock sing-box has neither. Such links are imported, marked unsupported and left out of the config. |
| Balancer | "Auto" is a sing-box `urltest` (lowest delay, failover). Pinning a server switches a `selector` through the Clash API, without a restart, like the other clients. |
| Interception | nftables TPROXY into sing-box; DNS through sing-box, FakeIP for routed domains (as podkop). |
| Modes | Selective (only lists go through the tunnel), global (everything except exclusions), per device, through the router's own VPN interfaces. All in 1.9.0. |
| UI | `luci-app-we1ssconnect`: views in the clients' style; `we1ssconnect` command over SSH. |
| Code | `openwrt/` in this repository; same version and release as the other clients. |
| Packages | `PKGARCH:=all`, built with the OpenWrt SDK as `.ipk` (24.10) and `.apk` (25.12). |

## Packages and files

`we1ssconnect` (depends on `sing-box`, `kmod-nft-tproxy`, `dnsmasq-full`, `ca-bundle`,
`ucode-mod-fs`, `ucode-mod-uci`, `ucode-mod-ubus`, `ucode-mod-uloop`):

| Path | Role |
| --- | --- |
| `/etc/config/we1ssconnect` | UCI: settings, subscriptions, groups, rules, devices |
| `/etc/we1ssconnect/servers.json` | servers (manual and from subscriptions); too many for UCI |
| `/etc/init.d/we1ssconnect` | procd service: build config, nft, dnsmasq, run sing-box |
| `/usr/bin/we1ssconnect` | CLI: `start/stop/status`, `sub add/update/rm`, `import`, `ping`, `select`, `diag`, `update` |
| `/usr/share/ucode/we1ssconnect/*.uc` | modules: `links`, `subscription`, `store`, `singbox`, `nft`, `dnsmasq`, `lists`, `clash`, `util` |
| `/usr/share/rpcd/ucode/we1ssconnect.uc` | rpcd object `we1ssconnect` for LuCI |
| `/var/run/we1ssconnect/` | generated `config.json`, `rules.nft`, state |

`luci-app-we1ssconnect`: views `overview`, `servers`, `subscriptions`, `routing`, `devices`,
`settings`, `diagnostics`; menu, ACL, `ru` translation.

## Configuration model (UCI)

- `settings main`: `enabled`, `mode` (`selective`/`global`), `selected` (`auto` or a server id),
  `urltest_url`, `urltest_interval`, `urltest_tolerance`, `dns_type` (`doh`/`dot`/`udp`),
  `dns_server`, `bootstrap_dns`, `direct_dns`, `source_iface` (list, default `br-lan`),
  `ipv6`, `lan_proxy` + `lan_proxy_port`, `block_quic`, `exclude_ntp`, `fragment`, `mux`,
  `force_chrome_fp`, `list_update_interval`, `lists_via_tunnel`, `sub_update_interval`,
  `manage_dnsmasq`, `log_level`.
- `subscription`: `name`, `url`, `enabled`, `filter` (regex on names), `user_agent`.
- `group`: `name`, `subscription` and/or `server` ids, `filter`. Each group is its own urltest
  plus selector; "Auto" is the implicit group of every server.
- `rule` (order = priority): `name`, `enabled`, `action` (`proxy`/`vpn`/`direct`/`block`),
  `target` (`auto`, `group:<id>`, `server:<id>`), `interface` (for `vpn`), `service` (list of
  community lists), `preset` (`ru`, `ads`), `remote_list` (URLs: `.srs`, `.json` rule-sets or
  plain text domain/CIDR lists), `domain`, `subnet`.
- `device`: `name`, `ip`, `mode` (`tunnel`: all its traffic through the tunnel; `bypass`:
  nothing through the tunnel).

## Traffic path

1. dnsmasq forwards every query to the sing-box DNS inbound (`127.0.0.42:53`); the original
   dnsmasq settings are saved and restored on stop (`manage_dnsmasq=0` leaves dnsmasq alone).
2. sing-box DNS: block rules → reject; direct rules → `direct_dns`; proxy/vpn rules →
   FakeIP (`198.18.0.0/15`); everything else → `dns_server` (through the tunnel in global mode).
3. nft table `inet we1ssconnect`, prerouting on `source_iface`:
   private and reserved destinations return; `bypass` devices only have the FakeIP range
   intercepted; `tunnel` devices and global mode intercept all TCP/UDP; selective mode
   intercepts the FakeIP range and the subnets of proxy/vpn rules. Intercepted packets get
   TPROXY to sing-box (`:1602`) with a fwmark routed to `lo` by `ip rule`.
4. sing-box route: sniff, hijack DNS, private → direct, then the user's rules in order, then
   devices, then `final` (`direct` in selective mode, the selected group in global mode).
   sing-box's own sockets carry `routing_mark` so they are never intercepted.
5. Outbounds: one per server (`s-<id>`), a urltest + selector per group, `direct`, one
   `direct` bound to each VPN interface (`bind_interface`), `block`.

Lists are sing-box rule-sets that sing-box downloads and refreshes itself
(`update_interval`, `download_detour` = direct or the tunnel): community lists from
`itdoginfo/allow-domains` releases (fetched at runtime, not bundled), presets from SagerNet
rule-sets (`geosite-category-ru`, `geoip-ru`, `geosite-category-ads-all`), the user's
remote lists. Plain-text remote lists are converted to inline rules by the backend.

## Live data

The Clash API listens on `127.0.0.1:9090` with a random secret in `/var/run/we1ssconnect`.
The rpcd object proxies it: per-server delay, current server, traffic rate, connections.
An internal mixed inbound (`127.0.0.1:2081`) routed to the selected group serves the exit IP
check (ip-api, middle of the IP hidden like the other clients) and the speed test.

## Import

Share links: `vless` (Reality, Vision, TLS, WS, gRPC, HTTPUpgrade), `vmess`, `trojan`, `ss`
(SIP002 and legacy), `hysteria2`/`hy2`, `tuic`, `socks`, `http(s)`. Subscriptions: plain or
base64 bodies, `profile-title` and `subscription-userinfo` headers (traffic and expiry shown),
names kept stable across refreshes, auto-update by cron. With `force_chrome_fp` Reality and
TLS servers use the `chrome` uTLS fingerprint (the Xray 26.9.8+ Reality fix).

## Errors

- A bad link is skipped with a reason; the rest of the subscription still imports.
- The service refuses to start, and leaves nft and dnsmasq untouched, when `sing-box check`
  rejects the generated config; the reason is shown in LuCI and `we1ssconnect status`.
- If sing-box exits, procd respawns it; nft rules are removed on stop so a dead core never
  black-holes the LAN.

## Testing

- `openwrt/tests/*.uc`: unit tests run with `ucode` inside `openwrt/rootfs` 24.10 and 25.12
  containers (link parsing, config building, nft rendering).
- Every generated sample config passes `sing-box check` with the feed's sing-box of that
  release; every rendered ruleset passes `nft -c -f`.
- End-to-end in CI: OpenWrt x86-64 in QEMU with the built packages, a sing-box server on the
  runner, and a LAN client namespace checking that listed domains go through the server and
  others go direct, in both modes.
