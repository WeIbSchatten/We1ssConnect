<p align="center"><img src="docs/assets/logo.svg" width="96" alt="We1ssConnect"></p>

<h1 align="center">We1ssConnect</h1>

<p align="center">VPN-клиент для Android, Windows и Linux на ядре Xray · VPN client for Android, Windows and Linux on the Xray core</p>

<p align="center">
  <a href="https://github.com/WeIbSchatten/We1ssConnect/releases/latest">Скачать / Download</a> ·
  <a href="https://weibschatten.github.io/We1ssConnect/#/ru/">Документация</a> ·
  <a href="https://weibschatten.github.io/We1ssConnect/#/en/">Documentation</a>
</p>

## Возможности

- Xray-core внутри приложения: VLESS (Reality, Vision, XHTTP), VMess, Trojan, Shadowsocks, Hysteria2.
- Подписки панели [We1ssBoard](https://github.com/WeIbSchatten/We1ssBoard) и других, ссылки на ключи, QR-коды; группы ключей.
- Пинг до и во время подключения, автовыбор сервера по задержке или по кругу.
- Внешний IP (середина скрыта), страна, город, провайдер, скорость и трафик за сеанс.
- Маршрутизация по приложениям, пресеты «Российские сайты напрямую» и «Блокировать рекламу».
- DNS (Cloudflare, Google, Quad9, DoH), IPv6, фрагментация TLS, mux, исправление Reality для Xray 26.9.8+.
- Плитка в шторке, автообновление подписок, обновление приложения из него самого.
- Тёмная, светлая и AMOLED-темы, русский и английский язык.

## Features

- Xray-core inside the app: VLESS (Reality, Vision, XHTTP), VMess, Trojan, Shadowsocks, Hysteria2.
- [We1ssBoard](https://github.com/WeIbSchatten/We1ssBoard) and other subscriptions, share links, QR codes; key groups.
- Ping before and during the connection, automatic server choice by lowest delay or round robin.
- Exit IP (middle hidden), country, city, ISP, speed and session traffic.
- Per-app routing, "Russian sites directly" and "Block ads" presets.
- DNS (Cloudflare, Google, Quad9, DoH), IPv6, TLS fragmentation, mux, the Reality fix for Xray 26.9.8+.
- Quick settings tile, subscription auto-update, in-app updates.
- Dark, light and AMOLED themes, Russian and English.

## Сборка · Building

```bash
npm ci
scripts/build-libxray.sh             # Go, Android SDK + NDK
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease

# Windows / Linux (Go, Wails CLI v2.17.0; on Linux libwebkit2gtk-4.1-dev)
npm run desktop:web
cd desktop && wails build -s            # Linux: add -tags webkit2_41
```

Подробности: [для разработчиков](https://weibschatten.github.io/We1ssConnect/#/ru/develop) ·
details: [for developers](https://weibschatten.github.io/We1ssConnect/#/en/develop).

## Лицензии · Third-party software

[NOTICE.md](NOTICE.md): Xray-core (MPL-2.0), libXray (MIT), Wails (MIT).
