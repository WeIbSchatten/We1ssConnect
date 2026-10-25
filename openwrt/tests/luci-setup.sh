#!/bin/sh
# Runs inside a booted OpenWrt container: installs LuCI and the built packages with the
# release's own package manager, then connects the client to a local shadowsocks server.
set -eu

if command -v apk > /dev/null; then
	apk update > /dev/null
	apk add luci luci-i18n-base-ru > /dev/null
	apk add --allow-untrusted /pkgs/*.apk
else
	opkg update > /dev/null
	opkg install luci luci-i18n-base-ru > /dev/null
	opkg install /pkgs/*.ipk
fi

printf 'test\ntest\n' | passwd root > /dev/null
uci set luci.main.lang=ru
uci commit luci

cat > /tmp/server.json <<'EOF'
{"log":{"level":"warn"},"inbounds":[{"type":"shadowsocks","listen":"127.0.0.1","listen_port":8388,"method":"aes-128-gcm","password":"testpw"}],"outbounds":[{"type":"direct"}]}
EOF
start-stop-daemon -S -b -x /usr/bin/sing-box -- run -c /tmp/server.json

we1ssconnect import "ss://$(echo -n 'aes-128-gcm:testpw' | base64)@127.0.0.1:8388#Нидерланды
vless://u@h:443?type=xhttp&security=reality&pbk=k#Финляндия XHTTP
trojan://pw@192.0.2.10:443#Германия" > /dev/null
uci set we1ssconnect.r_youtube.enabled=1
uci set we1ssconnect.r_ru.enabled=1
uci commit we1ssconnect
we1ssconnect status > /dev/null
ubus call we1ssconnect set_enabled '{"enabled": true}' > /dev/null
sleep 3
we1ssconnect status
