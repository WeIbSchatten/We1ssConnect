# Servers and subscriptions

## Groups

Servers are kept in groups:

- a **subscription** (cloud icon) is a list from a server that can be refreshed;
- a **key group** (key icon) holds links added by hand or by QR code. Every addition makes a
  new group, so keys from different people never mix.

Tap a group's header for its menu:

- **Update subscription** downloads the list again (subscriptions only);
- **Remove group** removes the subscription or key group with its servers.

## Server actions

- **Tap** picks the server. With the VPN on, it switches on the fly.
- **Long press** opens a menu: **Copy link** (a ready `vless://…` link to share) and **Remove**.

## Buttons above the list

| Button | What it does |
| --- | --- |
| Test delay | measures every server's delay; works while the VPN is off, and while connected the delays update on their own |
| ⇅ | sorts servers by delay |
| ⟳ | updates every subscription (or pull the list down) |
| + | adds a subscription, links or a QR code |

## Subscription updates

With **Update subscriptions on start** on, subscriptions older than 12 hours are refreshed when
the app opens. The chosen server stays chosen if it is still in the subscription.

The app reads the subscription headers:

- `profile-title`: the name (plain or `base64:`);
- `subscription-userinfo`: traffic used, the limit and the expiry, shown on Home.

## Protocols

VLESS (including Reality, XTLS Vision, XHTTP, WebSocket, gRPC), VMess, Trojan, Shadowsocks and
Hysteria2. A subscription can be base64, a list of links or an Xray JSON config.
