#!/usr/bin/env bash
# Builds libXray.aar (Xray-core for Android, via gomobile) into a file-based Maven
# repository inside the xray-vpn module, as com.we1bschatten:libxray:1.0.
# Needs Go, the Android SDK and NDK (ANDROID_HOME / ANDROID_NDK_HOME).
set -euo pipefail

LIBXRAY_VERSION="${LIBXRAY_VERSION:-v26.10.17}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/modules/xray-vpn/android/libs"
repo="$out/maven/com/we1bschatten/libxray/1.0"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet --depth 1 --branch "$LIBXRAY_VERSION" https://github.com/XTLS/libXray "$work/libXray"
cd "$work/libXray"
python3 build/main.py android

rm -rf "$out"
mkdir -p "$repo"
cp libXray.aar "$repo/libxray-1.0.aar"
cat > "$repo/libxray-1.0.pom" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.we1bschatten</groupId>
  <artifactId>libxray</artifactId>
  <version>1.0</version>
  <packaging>aar</packaging>
  <description>libXray $LIBXRAY_VERSION</description>
</project>
POM
echo "libXray $LIBXRAY_VERSION → $repo"
