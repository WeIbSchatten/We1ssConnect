#!/bin/sh
# Installs or updates We1ssConnect on OpenWrt 24.10 (opkg, .ipk) or 25.12 (apk, .apk) from the
# latest GitHub release:  wget -qO- https://raw.githubusercontent.com/WeIbSchatten/We1ssConnect/main/openwrt/install.sh | sh
set -eu

REPO=WeIbSchatten/We1ssConnect
tmp=/tmp/we1ssconnect-install
rm -rf "$tmp" && mkdir -p "$tmp"

if command -v apk > /dev/null 2>&1; then
	fmt=apk
else
	fmt=ipk
fi
echo "We1ssConnect: OpenWrt $(. /etc/openwrt_release; echo "$DISTRIB_RELEASE"), .$fmt packages"

installed() {
	if [ "$fmt" = apk ]; then
		apk info -e "$1" > /dev/null 2>&1
	else
		opkg status "$1" 2> /dev/null | grep -q '^Status:.* installed'
	fi
}

# Only a fresh sing-box needs ~25 MB; our own packages take a few hundred KB.
free_kb="$(df -k /overlay 2> /dev/null | awk 'NR == 2 { print $4 }')"
if installed sing-box; then
	need_kb=2048 need="Not enough flash for the update: about 2 MB needed on /overlay"
else
	need_kb=25000 need="Not enough flash: sing-box needs about 25 MB free on /overlay"
fi
if [ -n "$free_kb" ] && [ "$free_kb" -lt "$need_kb" ]; then
	echo "$need, $((free_kb / 1024)) MB left." >&2
	exit 1
fi

# fetch <url> <file or ->. uclient-fetch gives up on the first github.com address that times
# out; curl (installed with We1ssConnect) tries the others and retries.
fetch() {
	if command -v curl > /dev/null 2>&1; then
		curl -fsSL --retry 3 --connect-timeout 15 -o "$2" "$1"
	else
		wget -qO "$2" "$1"
	fi
}

api="$(fetch "https://api.github.com/repos/$REPO/releases/latest" -)" || {
	echo "GitHub did not answer; check the router's internet access." >&2
	exit 1
}
urls="$(echo "$api" | grep -oE "\"browser_download_url\": *\"[^\"]*/(we1ssconnect-openwrt|luci-app-we1ssconnect|luci-i18n-we1ssconnect-ru)-[^\"]*\.$fmt\"" | sed 's/.*"\(https[^"]*\)"/\1/')"
[ -n "$urls" ] || { echo "The latest release has no .$fmt packages." >&2; exit 1; }

for url in $urls; do
	name="$(basename "$url")"
	echo "Downloading $name"
	fetch "$url" "$tmp/$name" || {
		echo "Could not download $name; check the router's access to github.com." >&2
		exit 1
	}
done

if [ "$fmt" = apk ]; then
	apk update > /dev/null
	apk add --allow-untrusted "$tmp"/*.apk
else
	opkg update > /dev/null
	opkg install "$tmp"/*.ipk
fi
rm -rf "$tmp"

echo
echo "Done. Open LuCI → Services → We1ssConnect, add a subscription or keys and press Connect."
