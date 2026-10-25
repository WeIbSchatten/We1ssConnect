#!/bin/sh
# Installs the package files into this OpenWrt container and drives the real CLI against a
# local shadowsocks server: import, prepare, apply-net, a request through the tunnel, cleanup.
set -u

root="$1"
fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

cp -a "$root/we1ssconnect/files/." /
chmod +x /usr/bin/we1ssconnect /etc/init.d/we1ssconnect
export WE1SS_STATE_DIR=/etc/we1ssconnect
rm -rf /etc/we1ssconnect /var/run/we1ssconnect
mkdir -p /etc/crontabs /tmp/we1ss-it
touch /etc/crontabs/root

cat > /tmp/we1ss-it/server.json <<'EOF'
{"log":{"level":"info"},"inbounds":[{"type":"shadowsocks","listen":"127.0.0.1","listen_port":8388,"method":"aes-128-gcm","password":"testpw"}],"outbounds":[{"type":"direct"}]}
EOF
sing-box run -c /tmp/we1ss-it/server.json > /tmp/we1ss-it/server.log 2>&1 &
server_pid=$!

link="ss://$(printf 'aes-128-gcm:testpw' | base64)@127.0.0.1:8388#Local"
out="$(we1ssconnect import "$link
vless://u@h:443?type=xhttp#Broken")"
check "import adds one server and explains the skipped one" \
	'echo "$out" | grep -q "\"added\": 1" && echo "$out" | grep -q "xhttp transport is not supported"'
id="$(we1ssconnect servers | ucode -e 'import { readfile } from "fs"; let j = json(readfile("/dev/stdin")); print(filter(j.servers, s => s.ok)[0].id);')"
check "the server got an id" '[ -n "$id" ]'

uci set we1ssconnect.main.enabled=1
uci set we1ssconnect.r_youtube.enabled=1
uci set we1ssconnect.r_ru.enabled=1
uci add we1ssconnect rule > /dev/null
uci set we1ssconnect.@rule[-1].name=Custom
uci set we1ssconnect.@rule[-1].action=proxy
uci add_list we1ssconnect.@rule[-1].domain=example.com
uci add_list we1ssconnect.@rule[-1].subnet=203.0.113.0/24
uci set we1ssconnect.main.sub_update_interval=6h
uci commit we1ssconnect

check "prepare builds a config sing-box accepts" 'we1ssconnect prepare > /tmp/we1ss-it/prepare.json'
check "the status file has no hard error" 'ucode -e "import { readfile } from \"fs\"; exit(json(readfile(\"/var/run/we1ssconnect/status.json\")).ok ? 0 : 1);"'
check "cron refreshes subscriptions every 6 hours" 'grep -q "^0 \*/6 \* \* \* /usr/bin/we1ssconnect sub-update all" /etc/crontabs/root'

# podkop names table 105 in rt_tables, so ip rule prints "lookup podkop" (as on a real router).
mkdir -p /etc/iproute2 && echo '105 podkop' >> /etc/iproute2/rt_tables
check "apply-net loads the nft table" 'we1ssconnect apply-net > /tmp/we1ss-it/apply.json; nft list table inet we1ssconnect > /tmp/we1ss-it/table.nft'
check "the listed subnet is in route4" 'grep -q "203.0.113.0/24" /tmp/we1ss-it/table.nft'
check "marked packets go to the local TPROXY route" 'ip rule | grep -q "fwmark 0x100000/0x100000"'
check "dnsmasq forwards to sing-box" '[ "$(uci -q get dhcp.@dnsmasq[0].server)" = "127.0.0.42" ]'

sing-box run -c /var/run/we1ssconnect/config.json -D /var/run/we1ssconnect > /tmp/we1ss-it/client.log 2>&1 &
client_pid=$!
for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:9090/ && break; sleep 1; done

check "status reports running with the Local server" 'we1ssconnect status > /tmp/we1ss-it/status.json; grep -q "\"running\": true" /tmp/we1ss-it/status.json'
check "a request through the tunnel works" '[ "$(curl -s -o /dev/null -w "%{http_code}" -m 10 -x socks5h://127.0.0.1:2081 https://www.gstatic.com/generate_204)" = 204 ]'
check "the shadowsocks server carried it" 'sleep 1; grep -q "inbound connection to www.gstatic.com:443" /tmp/we1ss-it/server.log'
check "ping goes through the tunnel" 'we1ssconnect ping | grep -q "\"via\": \"tunnel\""'
check "pinning a server switches the selector without a restart" \
	'we1ssconnect select "$id" > /tmp/we1ss-it/select.json; curl -s -H "Authorization: Bearer $(cat /var/run/we1ssconnect/secret)" http://127.0.0.1:9090/proxies/main > /tmp/we1ss-it/main.json; grep -q "\"now\": *\"s-$id\"" /tmp/we1ss-it/main.json'
check "the pin is saved in UCI" '[ "$(uci get we1ssconnect.main.selected)" = "$id" ]'
check "the exit IP is found through the tunnel" 'we1ssconnect ip | grep -q "\"ip\""'
check "diagnostics accept the routing table under podkop's name" 'we1ssconnect diag | grep -A1 "\"name\": \"policy routing\"" | grep -q "\"ok\": true"'
check "diagnostics see the running service" 'we1ssconnect diag > /tmp/we1ss-it/diag.json; grep -A1 "\"name\": \"tunnel\"" /tmp/we1ss-it/diag.json | grep -q "\"ok\": true"'

kill $client_pid $server_pid 2> /dev/null
check "cleanup removes the table, the route and restores dnsmasq" \
	'we1ssconnect cleanup > /dev/null; ! nft list table inet we1ssconnect > /dev/null 2>&1 && ! ip rule | grep -q "lookup 105" && [ -z "$(uci -q get dhcp.@dnsmasq[0].server)" ]'

if [ "$fails" -gt 0 ]; then
	for f in prepare.json apply.json status.json select.json main.json diag.json client.log; do echo "--- $f"; cat "/tmp/we1ss-it/$f" 2> /dev/null | head -40; done
fi
echo "integration: $fails failed"
[ "$fails" -eq 0 ]
