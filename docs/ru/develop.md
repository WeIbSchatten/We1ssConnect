# Для разработчиков

## Устройство

```
src/                 интерфейс: React Native + Expo Router
  app/               экраны (вкладки, добавление, приложения, QR)
  lib/               конфиг Xray, подписки, хранилище, обновления, живые данные
modules/xray-vpn/    локальный модуль Expo на Kotlin
  XrayVpnService     VpnService: TUN, правила приложений, уведомление
  XrayVpnModule      мост к JS: запуск, пинг, приложения, правила, обновления
  VpnTileService     плитка в быстрых настройках
core/                пакет Go xraybridge: Xray внутри приложения
scripts/             сборка ядра и проверка на эмуляторе
docs/                этот сайт (docsify)
```

- **Туннель.** `XrayVpnService` открывает TUN и передаёт дескриптор во входящий `tun` самого
  Xray через `env.xray.tun.fd`, поэтому отдельного tun2socks нет. Само приложение исключено из
  туннеля.
- **Ядро.** Пакет `core/` (xraybridge) собирается `gomobile bind` вместе с libXray в один AAR.
  Он запускает Xray в процессе приложения и отдаёт данные наблюдателя (задержки), цель
  балансировщика и её закрепление, счётчики трафика и HTTP-запросы через нужный outbound.
  Локальных портов не открывается.
- **Балансировщик.** Каждый сервер — outbound `s-<id>` за балансировщиком `main`
  (`leastPing` или `roundrobin`), наблюдатель проверяет серверы каждые 30 секунд. Ручной выбор
  делается через override балансировщика, без перезапуска.
- **Правила.** `geoip.dat` и `geosite.dat` скачиваются в `files/geo`, путь передаётся через
  `xray.location.asset`.

## Сборка

```bash
npm ci
scripts/build-libxray.sh             # нужны Go, Android SDK и NDK
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Проверки:

```bash
npx tsc --noEmit && npx expo lint && npx jest --ci
(cd core && go vet ./... && go test ./...)
```

## CI и релизы

`.github/workflows/android.yml` проверяет код, собирает APK (arm64-v8a, armeabi-v7a и x86_64
для эмулятора) и запускает приложение на эмуляторе API 34.

Релиз: **Actions → Android → Run workflow** с номером версии. Workflow ставит версию и
`versionCode`, подписывает APK ключом из секретов `ANDROID_KEYSTORE_B64` и
`ANDROID_KEYSTORE_PASSWORD`, создаёт тег `v<версия>` и релиз с APK для arm64-v8a и armeabi-v7a
и файлом `SHA256SUMS`. Приложение находит обновления через последний релиз этого репозитория.

## Лицензии

Используются [Xray-core](https://github.com/XTLS/Xray-core) (MPL-2.0) и
[libXray](https://github.com/XTLS/libXray) (MIT) без изменений; см.
[NOTICE.md](https://github.com/WeIbSchatten/We1ssConnect/blob/main/NOTICE.md).
