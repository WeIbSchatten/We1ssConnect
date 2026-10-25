#!/bin/sh
# Real servers of each protocol in this container, imported from share links shaped like the
# panel's (fp=chrome, alpn=h2,http/1.1); every one must carry a request when pinned.
set -u

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
dir=/tmp/we1ss-proto
rm -rf $dir /etc/we1ssconnect /var/run/we1ssconnect
mkdir -p $dir
cp "$1/we1ssconnect/files/etc/config/we1ssconnect" /etc/config/we1ssconnect

# A self-signed certificate for test.local, as the servers' TLS.
sing-box generate tls-keypair test.local -m 1 > $dir/pair.pem
awk '/BEGIN PRIVATE KEY/,/END PRIVATE KEY/' $dir/pair.pem > $dir/key.pem
awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' $dir/pair.pem > $dir/cert.pem
uuid=$(sing-box generate uuid)
reality="$(sing-box generate reality-keypair)"
rpriv=$(echo "$reality" | awk '/PrivateKey/ { print $2 }')
rpub=$(echo "$reality" | awk '/PublicKey/ { print $2 }')
tls="\"enabled\":true,\"server_name\":\"test.local\",\"certificate_path\":\"$dir/cert.pem\",\"key_path\":\"$dir/key.pem\""

cat > $dir/server.json <<EOF
{"log":{"level":"warn"},
 "inbounds":[
  {"type":"hysteria2","listen":"127.0.0.1","listen_port":8443,"users":[{"password":"hypw"}],"obfs":{"type":"salamander","password":"ob"},"tls":{$tls,"alpn":["h3"]}},
  {"type":"vless","listen":"127.0.0.1","listen_port":8444,"users":[{"uuid":"$uuid"}],"transport":{"type":"ws","path":"/ws"},"tls":{$tls,"alpn":["h2","http/1.1"]}},
  {"type":"vless","listen":"127.0.0.1","listen_port":8445,"users":[{"uuid":"$uuid"}],"transport":{"type":"grpc","service_name":"svc"},"tls":{$tls,"alpn":["h2"]}},
  {"type":"trojan","listen":"127.0.0.1","listen_port":8446,"users":[{"password":"trpw"}],"tls":{$tls,"alpn":["h2","http/1.1"]}},
  {"type":"vless","listen":"127.0.0.1","listen_port":8447,"users":[{"uuid":"$uuid","flow":"xtls-rprx-vision"}],"tls":{"enabled":true,"server_name":"www.microsoft.com","reality":{"enabled":true,"handshake":{"server":"www.microsoft.com","server_port":443},"private_key":"$rpriv","short_id":["ab12"]}}},
  {"type":"tuic","listen":"127.0.0.1","listen_port":8448,"users":[{"uuid":"$uuid","password":"tupw"}],"congestion_control":"bbr","tls":{$tls,"alpn":["h3"]}}
 ],
 "outbounds":[{"type":"direct"}]}
EOF
sing-box run -c $dir/server.json > $dir/server.log 2>&1 &
server_pid=$!

we1ssconnect import "hysteria2://hypw@127.0.0.1:8443/?sni=test.local&insecure=1&obfs=salamander&obfs-password=ob&fp=chrome#HY2
vless://$uuid@127.0.0.1:8444?type=ws&security=tls&sni=test.local&allowInsecure=1&alpn=h2%2Chttp%2F1.1&fp=chrome&path=%2Fws&host=test.local#WS
vless://$uuid@127.0.0.1:8445?type=grpc&serviceName=svc&security=tls&sni=test.local&allowInsecure=1&alpn=h2%2Chttp%2F1.1&fp=chrome#GRPC
trojan://trpw@127.0.0.1:8446?security=tls&sni=test.local&allowInsecure=1&alpn=h2%2Chttp%2F1.1&fp=chrome#TROJAN
vless://$uuid@127.0.0.1:8447?type=tcp&security=reality&pbk=$rpub&sid=ab12&sni=www.microsoft.com&fp=chrome&flow=xtls-rprx-vision#REALITY
tuic://$uuid:tupw@127.0.0.1:8448?congestion_control=bbr&alpn=h3&sni=test.local&allow_insecure=1&fp=chrome#TUIC" > $dir/import.json

uci set we1ssconnect.main.enabled=1
uci commit we1ssconnect
we1ssconnect prepare > $dir/prepare.json || { echo "FAIL prepare"; cat $dir/prepare.json; exit 1; }
sing-box run -c /var/run/we1ssconnect/config.json -D /var/run/we1ssconnect > $dir/client.log 2>&1 &
client_pid=$!
for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:9090/ && break; sleep 1; done

id_of() {
	we1ssconnect servers | ucode -e "import { readfile } from 'fs'; for (let s in json(readfile('/dev/stdin')).servers) if (s.name == '$1') print(s.id);"
}
for name in HY2 WS GRPC TROJAN REALITY TUIC; do
	id=$(id_of $name)
	we1ssconnect select "$id" > /dev/null
	sleep 1
	code=$(curl -s -o /dev/null -w '%{http_code}' -m 12 -x socks5h://127.0.0.1:2081 https://www.gstatic.com/generate_204)
	if [ "$code" = 204 ]; then pass "$name carries a request"; else fail "$name carries a request (got $code)"; fi
done

kill $client_pid $server_pid 2> /dev/null
if [ "$fails" -gt 0 ]; then
	echo "--- client.log"; grep -v 'inbound connection' $dir/client.log | tail -n 30
	echo "--- server.log"; tail -n 20 $dir/server.log
fi
echo "protocols: $fails failed"
[ "$fails" -eq 0 ]
