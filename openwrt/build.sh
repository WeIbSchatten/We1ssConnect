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
find bin/packages -type f \( -name 'we1ssconnect*' -o -name 'luci-app-we1ssconnect*' -o -name 'luci-i18n-we1ssconnect*' \) \
	\( -name '*.ipk' -o -name '*.apk' \) -exec cp {} "$out/" \;
ls -l "$out"
