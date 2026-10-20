#!/usr/bin/env bash
# Runs on the CI emulator: installs the APK, opens the app, and fails if it
# crashes or libXray cannot load.
set -uo pipefail
pkg=com.we1bschatten.we1ssconnect
mkdir -p smoke
adb install -r apk/*.apk || exit 1
adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1
sleep 20
adb exec-out screencap -p > smoke/home.png
# Settings shows the Xray version, which needs the native core.
adb shell am start -a android.intent.action.VIEW -d "we1ssconnect://settings" "$pkg"
sleep 8
adb exec-out screencap -p > smoke/settings.png
adb shell uiautomator dump /sdcard/ui.xml >/dev/null && adb pull /sdcard/ui.xml smoke/settings.xml >/dev/null
adb logcat -d > smoke/logcat.txt
if ! adb shell pidof "$pkg" >/dev/null; then
  echo "app is not running"; grep -E "FATAL|AndroidRuntime" -A20 smoke/logcat.txt | head -60; exit 1
fi
if grep -q "FATAL EXCEPTION" smoke/logcat.txt; then
  grep "FATAL EXCEPTION" -A30 smoke/logcat.txt | head -60; exit 1
fi
# The About card reads "Xray core <version>" once libXray answers (the emulator runs in English).
core="$(grep -oE 'Xray core [0-9]+\.[0-9]+\.[0-9]+' smoke/settings.xml | head -1)"
if [[ -z "$core" ]]; then
  echo "settings screen does not show the Xray core version"
  grep -oE 'text="[^"]*"' smoke/settings.xml | head -40
  exit 1
fi
echo "smoke OK: $core"
