# LuCI redesign and podkop-style service control

Date: 2026-11-21. Area: `openwrt/luci-app-we1ssconnect` and the service controls in
`openwrt/we1ssconnect` (rpcd, `service.uc`, `/etc/init.d/we1ssconnect`).

## Intent

The owner finds the router client's LuCI interface inconvenient and unattractive, and users do not
understand how the single Connect / Disconnect button works. Goal: a LuCI client that looks like
one product and is obvious to use, with service controls that work the way they do in podkop,
which many users know.

Today the six pages look like two products. Overview, Servers and Diagnostics are hand-built
`w1-*` cards; Routing, Devices and Settings are stock LuCI `form.Map` grids that the router theme
draws (proton2025 already broke checkboxes once) and that apply only after "Save & Apply".

## Goals

1. Every page is built from our own components in `we1ssconnect/common.js`, with one visual
   language, and looks the same in bootstrap and proton2025, light and dark.
2. Changes on Routing, Devices and Settings take effect when made, without "Save & Apply".
3. Service control as in podkop, on the Diagnostics page: service state and autostart are two
   separate things with separate buttons.
4. Works at phone width (LuCI is often opened from a phone).

## Non-goals

- No single-page app with its own navigation: the six LuCI menu entries and their URLs stay.
- No new routing or tunnel features; the uci schema stays (except as noted for service control).
- No change to the CLI command set beyond what service control needs.

## Anti-goals (failure even if it works)

- A stopped service that starts by itself on a settings edit, a list refresh or an Xray download.
- Users who had "Disconnected" finding the tunnel on after the update.
- A page that only works in one theme.

## Approaches considered

- **A. Own pages in one style inside LuCI — chosen by the owner.** All pages rendered with our
  components, data still in uci, menu entries unchanged. Most work (three form pages rewritten,
  e2e updated) but full control of look and behaviour.
- B. One page-application with its own navigation, like the We1ssConnect app. Breaks LuCI
  navigation and links, more work than A. Rejected.
- C. CSS only over the stock forms. Cheap, but forms stay forms, each theme draws them its own
  way, "Save & Apply" stays. Rejected.

## Decided by the owner

### Service control (podkop model, on Diagnostics)

A "Service" block at the top of the Diagnostics page, matching podkop's "Available actions":

```
Service     ● Running              [Stop] [Restart]
Autostart   ✔ Enabled              [Disable autostart]
```

- Start / Stop: one is shown, depending on whether the service runs. Restart is always shown.
- Enable / Disable autostart: one is shown, depending on the autostart state.
- Stop: the tunnel stops now; after a router reboot it comes back if autostart is on.
- Start: runs now; does not touch autostart.
- Autostart: only whether it starts at boot.
- Buttons are disabled with a spinner while a command runs; state refreshes after it.
- Overview (owner, 2026-11-21): no Connect / Disconnect toggle. While the service is stopped it
  shows one large "Start" button; while it runs, only the state. Stop, Restart and autostart live
  only on Diagnostics.

State model (owner approved these calls, 2026-11-21):

- **Autostart** is only procd boot start: `/etc/init.d/we1ssconnect enabled`. Start and Restart
  never change it.
- **Wanted** is a new runtime flag, `/var/run/we1ssconnect/wanted`: Start and Restart create it,
  Stop removes it, a boot start with autostart on creates it. `start_service` no longer reads uci
  `main.enabled`; the option is retired (read once by the migration below).
- **Running** = the existing `status().running` (sing-box pid + nft table).
- Restart-on-change (uci reload trigger, `restart_if_running()`, Xray download at
  `service.uc:174`) restarts when **wanted**, not when running, so an edit that fixes a broken
  config brings the tunnel back, and nothing ever starts a service the user stopped.

| Action            | Does                                                   |
|-------------------|--------------------------------------------------------|
| Start             | create `wanted`, `/etc/init.d/we1ssconnect start`       |
| Stop              | remove `wanted`, `/etc/init.d/we1ssconnect stop`        |
| Restart           | create `wanted`, `/etc/init.d/we1ssconnect restart`     |
| Enable autostart  | `/etc/init.d/we1ssconnect enable`                       |
| Disable autostart | `/etc/init.d/we1ssconnect disable`                      |

- rpcd: replace `set_enabled` with `service` taking `start|stop|restart|enable|disable`;
  `status()` gains `autostart` and `wanted`. CLI gains `start | stop | restart | enable | disable`.
- Migration (uci-defaults, once): uci `main.enabled=0` → `init.d disable`; `enabled=1` → keep
  init enabled. Then delete `main.enabled`. A legacy "Disconnected" router shows "Stopped,
  autostart disabled" and nothing turns on by itself.
- Package scripts: a fresh install leaves the service stopped and autostart disabled. An upgrade
  keeps both: postinst no longer runs `enable` unconditionally, and restarts only if the service
  was running before the upgrade (preinst records it). Same for `install.sh` / self-update.
- No confirmation dialogs (as in podkop).

### Pages (variant A)

- **Every page:** a status line at the top: "● Running / ○ Stopped · current server".
- **Overview:** mode switch, current server with a server picker, exit IP, traffic and a
  traffic sparkline for the last minutes, warnings, update notice.
- **Servers:** search, sort by delay, delay colour-coded (good / slow / bad), collapsible
  subscription blocks, rare actions (remove, panel page) in a "⋯" menu.
- **Routing:** rules as "what → where" cards with an on/off switch, drag to reorder, edit in a
  side panel; the "As text" view stays.
- **Devices:** devices from DHCP leases by name, each with "By rules / Everything through the
  tunnel / Nothing through the tunnel"; no typing IPs (manual entry stays possible for static
  devices without a lease). Devices stay keyed by IP (owner, 2026-11-21): a device whose address
  is a dynamic lease gets an "address may change" mark and a "Pin address" button that adds a
  static lease (`dhcp` uci `host` section: name, mac, ip) on click; DHCP is never changed
  without that click.
- **Settings:** cards by topic (today's tabs: DNS, Network, Connection, Lists, Advanced), DNS
  presets, saved on change.
- **Diagnostics:** Service block above; each failed check gets a hint what to do; log with a
  filter and a Copy button.

### Delivery

One PR per step, each checked in bootstrap and proton2025 (light and dark) and at phone width:

1. Shared components in `common.js` + status line + service control (backend and Diagnostics).
2. Devices. 3. Routing. 4. Servers. 5. Settings. 6. Overview and Diagnostics polish.

Then a We1ssConnect release (OpenWrt-only flow is fine if apps are unchanged).

## Constraints

- LuCI 24.10 and 25.12; ucode gotchas in `openwrt/DESIGN.md`. LuCI 24.10 renders GridSection
  titles from `data-title`; our own components avoid that entirely.
- Translations: every new string in `openwrt/i18n` ru catalog; `translations` CI job.
- Tests run only in GitHub Actions (`.github/workflows/openwrt.yml`): ucode unit tests,
  `openwrt/tests/luci-e2e.mjs` (Playwright on a booted container; its per-page expected texts
  change with the pages), `node --test openwrt/tests/rules_test.mjs`.
- Never run disruptive tests on the owner's live router (pure unit tests only).
- Writing to uci on change: use `uci.set` + `uci.save` + `uci.apply` (or an rpcd method), and
  restart the service only if it runs.

## Left to the builder

- Component API in `common.js` (cards, switch, segmented control, list rows, side panel, menu).
- Colour tokens that follow the theme's text colour (as `w1-*` does now with `currentColor` and
  translucent greys) rather than fixed palettes.
- Sparkline source: poll sing-box `/traffic` via existing status polling or a new rpcd method.
- Drag-to-reorder implementation (native HTML5 drag or up/down buttons on touch).
- How the e2e asserts each new page.
