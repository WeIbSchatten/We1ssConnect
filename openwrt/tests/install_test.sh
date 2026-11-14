#!/bin/sh
# install.sh against stubbed df/apk/wget: how much flash it demands for a fresh install
# versus an update over an installed sing-box. Usage: sh install_test.sh <openwrt dir>
set -u

root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
fails=0

# run <free KB> <sing-box installed: yes|no> [github.com for: both|curl-only|neither];
# leaves the output in $out, the exit code in $code and the apk calls in $calls.
run() {
	reach="${3:-both}"
	bin="$(mktemp -d)"
	log="$bin/calls"
	cat > "$bin/df" <<EOF
#!/bin/sh
echo "Filesystem 1K-blocks Used Available Use% Mounted on"
echo "overlayfs:/overlay 62158 41472 $1 70% /"
EOF
	cat > "$bin/apk" <<EOF
#!/bin/sh
echo "apk \$*" >> "$log"
case "\$1" in
	info) [ "$2" = yes ] ;;
	*) exit 0 ;;
esac
EOF
	# serve <url> <out file or -> <tool>: the release API answers; github.com downloads obey $reach.
	cat > "$bin/serve" <<EOF
#!/bin/sh
case "\$1" in
	*api.github.com*)
		d=https://github.com/x/releases/download/v9.9.9
		printf '{"assets":[{"browser_download_url": "%s/we1ssconnect-openwrt-9.9.9.apk"},{"browser_download_url": "%s/luci-app-we1ssconnect-9.9.9.apk"}]}' "\$d" "\$d" ;;
	*)
		case "$reach:\$3" in
			neither:*|curl-only:wget) exit 4 ;;
		esac
		: > "\$2" ;;
esac
EOF
	cat > "$bin/wget" <<EOF
#!/bin/sh
out=""; url=""
for a in "\$@"; do
	case "\$a" in
		-qO-) out=- ;;
		-qO) out=next ;;
		-*) ;;
		*) if [ "\$out" = next ]; then out="\$a"; else url="\$a"; fi ;;
	esac
done
exec "$bin/serve" "\$url" "\$out" wget
EOF
	cat > "$bin/curl" <<EOF
#!/bin/sh
out=-; url=""
while [ \$# -gt 0 ]; do
	case "\$1" in
		-o) out="\$2"; shift ;;
		--retry|--retry-delay|--connect-timeout|-m|--max-time) shift ;;
		-*) ;;
		*) url="\$1" ;;
	esac
	shift
done
exec "$bin/serve" "\$url" "\$out" curl
EOF
	chmod +x "$bin/df" "$bin/apk" "$bin/wget" "$bin/curl" "$bin/serve"
	out="$(PATH="$bin:$PATH" sh "$root/install.sh" 2>&1)"
	code=$?
	calls="$(cat "$log" 2> /dev/null)"
	rm -rf "$bin"
}

check() {
	if eval "$2"; then
		echo "ok   $1"
	else
		echo "FAIL $1"
		echo "     output: $out"
		fails=$((fails + 1))
	fi
}

run 17500 yes
check "an update over an installed sing-box fits in 17 MB" '[ $code -eq 0 ] && echo "$calls" | grep -q "apk add --allow-untrusted"'

run 17500 no
check "a fresh install still asks for the 25 MB sing-box needs" '[ $code -eq 1 ] && echo "$out" | grep -q "25 MB" && ! echo "$calls" | grep -q "apk add"'

run 900 yes
check "an update with under 2 MB free stops before downloading" '[ $code -eq 1 ] && echo "$out" | grep -q "2 MB" && ! echo "$calls" | grep -q "apk add"'

run 17500 yes curl-only
check "uclient-fetch timing out on github.com does not stop an update: curl downloads" '[ $code -eq 0 ] && echo "$calls" | grep -q "apk add --allow-untrusted"'

run 17500 yes neither
check "an unreachable github.com is reported, not a silent stop" '[ $code -eq 1 ] && echo "$out" | grep -q "Could not download we1ssconnect-openwrt-9.9.9.apk" && ! echo "$calls" | grep -q "apk add"'

echo "install: $fails failed"
[ "$fails" -eq 0 ]
