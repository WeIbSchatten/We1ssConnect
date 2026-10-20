# We1ssConnect

VPN client for [We1ssBoard](https://github.com/WeIbSchatten/We1ssBoard) panels, built on Xray-core.

Status: early development, Android first.

## How it works

- **UI**: React Native + Expo (`src/`), the same stack and palettes as the We1ssBoard mobile app.
- **Tunnel**: `modules/xray-vpn` is a local Expo module. Its `XrayVpnService` opens an Android
  `VpnService` TUN and hands the descriptor to Xray's own `tun` inbound, so all traffic goes
  through Xray-core with no separate tun2socks layer. The app itself is excluded from the tunnel,
  which keeps Xray's connections to the server out of it.
- **Core**: [libXray](https://github.com/XTLS/libXray) (`libXray.aar`, built by
  `scripts/build-libxray.sh`) wraps Xray-core for Android. It also parses share links and
  subscriptions and measures server delay.
- **Servers**: a subscription URL (base64 or plain links; `subscription-userinfo` and
  `profile-title` headers are shown) or vless/vmess/trojan/ss/hysteria2 share links.
  `we1ssconnect://add?url=<subscription>` opens the add screen with the link filled in.
- **Reality fix**: Reality servers on Xray 26.9.8+ drop clients whose ClientHello has no
  X25519MLKEM768. Xray's chrome fingerprint sends it, so the client switches Reality
  outbounds to `chrome` by default (Settings).

## Building

```bash
npm ci
scripts/build-libxray.sh            # needs Go, Android SDK + NDK
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

CI (`.github/workflows/android.yml`) does the same, runs the app on an emulator, and on a
`v*.*.*` tag, or a manual run of the workflow with a version, publishes the APK signed with
the `ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD` secrets as a GitHub release.

## Third-party software

See [NOTICE.md](NOTICE.md).
