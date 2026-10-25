#!/bin/sh
# Builds we1ssconnect, luci-app-we1ssconnect and its Russian translation inside an openwrt/sdk
# container: .ipk with the 24.10 SDK, .apk with 25.12. Usage: build.sh <src> <out> <version>
set -eu

src="$1" out="$2" version="$3"
cd /builder
[ -d scripts ] || ./setup.sh
./scripts/feeds update base luci > /dev/null
./scripts/feeds install luci-base > /dev/null
rm -rf package/we1ssconnect package/luci-app-we1ssconnect
cp -r "$src/we1ssconnect" "$src/luci-app-we1ssconnect" package/
make defconfig > /dev/null
make package/we1ssconnect/compile package/luci-app-we1ssconnect/compile WE1SS_VERSION="$version" -j"$(nproc)" V=s > build.log 2>&1 || {
	tail -n 80 build.log
	exit 1
}
mkdir -p "$out"
# Release names say "openwrt" so the router packages are not mistaken for the Android APKs.
for f in $(find bin/packages -type f \( -name '*.ipk' -o -name '*.apk' \)); do
	ext="${f##*.}"
	case "$(basename "$f")" in
	we1ssconnect[-_]*) cp "$f" "$out/we1ssconnect-openwrt-$version.$ext" ;;
	luci-app-we1ssconnect[-_]*) cp "$f" "$out/luci-app-we1ssconnect-$version.$ext" ;;
	luci-i18n-we1ssconnect-ru[-_]*) cp "$f" "$out/luci-i18n-we1ssconnect-ru-$version.$ext" ;;
	esac
done
ls -l "$out"
