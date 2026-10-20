#!/usr/bin/env bash
# Builds the Go core (core/: our xraybridge package plus libXray, both on Xray-core)
# with gomobile into a file-based Maven repository inside the xray-vpn module, as
# com.we1bschatten:libxray:1.0. Needs Go, the Android SDK and NDK (ANDROID_HOME /
# ANDROID_NDK_HOME). ABIS picks the Android ABIs (default: arm64, armv7, x86_64).
set -euo pipefail

ABIS="${ABIS:-android/arm64,android/arm,android/amd64}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/modules/xray-vpn/android/libs"
repo="$out/maven/com/we1bschatten/libxray/1.0"

cd "$root/core"
mobile="$(go list -m -f '{{.Version}}' golang.org/x/mobile)"
go install "golang.org/x/mobile/cmd/gomobile@$mobile" "golang.org/x/mobile/cmd/gobind@$mobile"
export PATH="$(go env GOPATH)/bin:$PATH"
gomobile init

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# The same flags libXray's own build uses.
gomobile bind -target "$ABIS" -androidapi 21 -trimpath \
  -ldflags="-checklinkname=0 -s -w -buildid= -extldflags=-Wl,-z,max-page-size=16384" \
  -o "$work/libxray.aar" . github.com/xtls/libxray

rm -rf "$out"
mkdir -p "$repo"
cp "$work/libxray.aar" "$repo/libxray-1.0.aar"
cat > "$repo/libxray-1.0.pom" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.we1bschatten</groupId>
  <artifactId>libxray</artifactId>
  <version>1.0</version>
  <packaging>aar</packaging>
</project>
POM
echo "core ($(go list -m -f '{{.Version}}' github.com/xtls/libxray)) → $repo"
