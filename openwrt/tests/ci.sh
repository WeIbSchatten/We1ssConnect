#!/bin/sh
# Runs inside an openwrt/rootfs container (24.10 opkg or 25.12 apk): installs the feed's
# sing-box, then runs the ucode unit tests and the sing-box/nft checks on generated output.
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
deps="curl coreutils-base64 ip-full sing-box ucode-mod-fs ucode-mod-uci ucode-mod-ubus ucode-mod-uloop nftables kmod-nft-tproxy"

mkdir -p /var/lock
if command -v apk > /dev/null; then
	apk update > /dev/null
	apk add $deps > /dev/null
else
	opkg update > /dev/null
	opkg install $deps > /dev/null
fi
echo "OpenWrt $(. /etc/openwrt_release; echo "$DISTRIB_RELEASE"), $(sing-box version | head -n 1)"

export WE1SS_TEST_ROOT="$root"
export WE1SS_STATE_DIR="$(mktemp -d)"
status=0
for t in "$root"/tests/*_test.uc; do
	echo "== $(basename "$t")"
	ucode -L "$root/tests/lib/*.uc" -L "$root/we1ssconnect/files/usr/share/ucode/*.uc" "$t" || status=1
done
echo "== integration.sh"
sh "$root/tests/integration.sh" "$root" || status=1
echo "== protocols.sh"
sh "$root/tests/protocols.sh" "$root" || status=1
echo "== e2e.sh"
sh "$root/tests/e2e.sh" "$root" || status=1
exit $status
