#!/bin/sh
# TPROXY end to end in a privileged container: a LAN client in its own network namespace
# behind br-lan, dnsmasq handing DNS to sing-box, and a local shadowsocks server whose log
# shows which connections went through the tunnel. Runs after integration.sh installed files.
set -u

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
in_lan() { ip netns exec lan "$@"; }
dir=/tmp/we1ss-e2e
mkdir -p $dir /etc/netns/lan

# LAN: br-lan (router side, 192.168.77.1) <-> lan0 in netns "lan" (client, 192.168.77.2).
ip netns add lan
ip link add br-lan type veth peer name lan0
ip link set lan0 netns lan
ip addr add 192.168.77.1/24 dev br-lan
ip link set br-lan up
in_lan ip addr add 192.168.77.2/24 dev lan0
in_lan ip link set lan0 up
in_lan ip link set lo up
in_lan ip route add default via 192.168.77.1
echo "nameserver 192.168.77.1" > /etc/netns/lan/resolv.conf
sysctl -qw net.ipv4.ip_forward=1 net.ipv4.conf.all.rp_filter=0 net.ipv4.conf.br-lan.rp_filter=0
wan="$(ip route show default | awk '{print $5; exit}')"
nft -f - <<EOF
table ip e2e_nat {
	chain post { type nat hook postrouting priority srcnat; oifname "$wan" masquerade; }
}
EOF

cat > $dir/server.json <<'EOF'
{"log":{"level":"info"},"inbounds":[{"type":"shadowsocks","listen":"127.0.0.1","listen_port":8388,"method":"aes-128-gcm","password":"testpw"}],"outbounds":[{"type":"direct"}]}
EOF
sing-box run -c $dir/server.json > $dir/server.log 2>&1 &
server_pid=$!

rm -rf /etc/we1ssconnect /var/run/we1ssconnect
cp /etc/config/we1ssconnect.orig /etc/config/we1ssconnect 2> /dev/null || cp /etc/config/we1ssconnect /etc/config/we1ssconnect.orig
we1ssconnect import "ss://$(printf 'aes-128-gcm:testpw' | base64)@127.0.0.1:8388#Local" > /dev/null
uci set we1ssconnect.main.enabled=1
uci set we1ssconnect.main.manage_dnsmasq=0
uci add we1ssconnect rule > /dev/null
uci set we1ssconnect.@rule[-1].name=Listed
uci add_list we1ssconnect.@rule[-1].domain=gstatic.com
uci add we1ssconnect rule > /dev/null
uci set we1ssconnect.@rule[-1].name=Direct
uci set we1ssconnect.@rule[-1].action=direct
uci add_list we1ssconnect.@rule[-1].domain=example.org
uci commit we1ssconnect

# dnsmasq the way the service configures it: everything to the sing-box DNS inbound.
dnsmasq --no-resolv --server=127.0.0.42 --listen-address=192.168.77.1 --bind-interfaces --no-hosts --pid-file=$dir/dnsmasq.pid

client_pid=
start() {
	[ -n "$client_pid" ] && kill $client_pid 2> /dev/null && sleep 1
	we1ssconnect cleanup > /dev/null
	we1ssconnect prepare > $dir/prepare.json && we1ssconnect apply-net > $dir/apply.json
	sing-box run -c /var/run/we1ssconnect/config.json -D /var/run/we1ssconnect > $dir/client.log 2>&1 &
	client_pid=$!
	for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:9090/ && break; sleep 1; done
}
tunneled() { grep -q "inbound connection to $1" $dir/server.log; }
fetch() { in_lan curl -s -o /dev/null -m 15 -w '%{http_code}' "$1"; }

start
check "selective: the client resolves a listed domain to FakeIP" 'in_lan nslookup www.gstatic.com 192.168.77.1 | grep -q "198\.1[89]\."'
check "selective: the listed domain loads" '[ "$(fetch https://www.gstatic.com/generate_204)" = 204 ]'
check "selective: and it went through the tunnel" 'sleep 1; tunneled www.gstatic.com'
check "selective: an unlisted site loads" '[ "$(fetch https://example.com/)" = 200 ]'
check "selective: but not through the tunnel" '! tunneled example.com'
in_lan nslookup example.com 192.168.77.1 > $dir/selective-dns.txt 2>&1
grep -o 'connection to [^ ]*' $dir/server.log | sort | uniq -c > $dir/selective-tunnel.txt
check "selective: a client with its own DNS server still gets FakeIP" 'in_lan nslookup www.gstatic.com 8.8.8.8 | grep -q "198\.1[89]\."'

uci set we1ssconnect.main.mode=global
uci commit we1ssconnect
: > $dir/server.log
start
check "global: an unlisted site loads" '[ "$(fetch https://example.com/)" = 200 ]'
check "global: through the tunnel" 'sleep 1; tunneled example.com'
check "global: a direct rule stays out of the tunnel" '[ "$(fetch https://example.org/)" = 200 ] && sleep 1 && ! tunneled example.org'

uci add we1ssconnect device > /dev/null
uci set we1ssconnect.@device[-1].ip=192.168.77.2
uci set we1ssconnect.@device[-1].mode=bypass
uci commit we1ssconnect
: > $dir/server.log
start
check "bypass device: nothing goes through the tunnel even in global mode" '[ "$(fetch https://example.com/)" = 200 ] && sleep 1 && ! tunneled example.com'

kill $client_pid $server_pid "$(cat $dir/dnsmasq.pid)" 2> /dev/null
we1ssconnect cleanup > /dev/null
if [ "$fails" -gt 0 ]; then
	for f in selective-dns.txt selective-tunnel.txt; do echo "--- $f"; cat "$dir/$f"; done
	echo "--- tunnel summary (last run)"; grep -o 'connection to [^ ]*' $dir/server.log | sort | uniq -c
	echo "--- client.log"; grep -v 'inbound connection from' $dir/client.log | tail -n 25
	nft list table inet we1ssconnect 2> /dev/null | head -60
fi
echo "e2e: $fails failed"
[ "$fails" -eq 0 ]
