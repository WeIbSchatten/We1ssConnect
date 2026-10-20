#!/usr/bin/env bash
# Builds libXray.aar (Xray-core for Android, via gomobile) into the xray-vpn module.
# Needs Go, the Android SDK and NDK (ANDROID_HOME / ANDROID_NDK_HOME).
set -euo pipefail

LIBXRAY_VERSION="${LIBXRAY_VERSION:-v26.10.17}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/modules/xray-vpn/android/libs"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet --depth 1 --branch "$LIBXRAY_VERSION" https://github.com/XTLS/libXray "$work/libXray"
cd "$work/libXray"
python3 build/main.py android

mkdir -p "$out"
cp libXray.aar "$out/libXray.aar"
echo "libXray $LIBXRAY_VERSION → $out/libXray.aar"
