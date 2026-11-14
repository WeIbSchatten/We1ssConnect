#!/bin/sh
# install.sh against stubbed df/apk/wget: how much flash it demands for a fresh install
# versus an update over an installed sing-box. Usage: sh install_test.sh <openwrt dir>
set -u

root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
fails=0

# run <free KB on /overlay> <sing-box installed: yes|no>; leaves output in $out, exit in $code.
run() {
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
	cat > "$bin/wget" <<'EOF'
#!/bin/sh
out=""; url=""
for a in "$@"; do
	case "$a" in
		-qO-) out=- ;;
		-qO) out=next ;;
		-*) ;;
		*) if [ "$out" = next ]; then out="$a"; else url="$a"; fi ;;
	esac
done
case "$url" in
	*api.github.com*)
		d=https://github.com/x/releases/download/v9.9.9
		printf '{"assets":[{"browser_download_url": "%s/we1ssconnect-openwrt-9.9.9.apk"},{"browser_download_url": "%s/luci-app-we1ssconnect-9.9.9.apk"}]}' "$d" "$d" ;;
	*) : > "$out" ;;
esac
EOF
	chmod +x "$bin/df" "$bin/apk" "$bin/wget"
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

echo "install: $fails failed"
[ "$fails" -eq 0 ]
