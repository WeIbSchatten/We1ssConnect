#!/bin/sh
# Real servers of each protocol in this container, imported from share links shaped like the
# panel's (fp=chrome, alpn=h2,http/1.1); every one must carry a request when pinned.
set -u

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
dir=/tmp/we1ss-proto
export WE1SS_STATE_DIR=/etc/we1ssconnect
rm -rf $dir /etc/we1ssconnect /var/run/we1ssconnect
mkdir -p $dir
cp "$1/we1ssconnect/files/etc/config/we1ssconnect" /etc/config/we1ssconnect

# The panel runs Xray, so its protocols are served by Xray 26.10.21 itself, with Xray's TLS
# defaults (ALPN h2,http/1.1); TUIC, which Xray lacks, by sing-box.
xray=/src/.xray/xray
[ -x "$xray" ] || { echo "FAIL Xray binary missing at $xray"; exit 1; }

sing-box generate tls-keypair test.local -m 1 > $dir/pair.pem
awk '/BEGIN PRIVATE KEY/,/END PRIVATE KEY/' $dir/pair.pem > $dir/key.pem
awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' $dir/pair.pem > $dir/cert.pem
uuid=$(sing-box generate uuid)
reality="$(sing-box generate reality-keypair)"
rpriv=$(echo "$reality" | awk '/PrivateKey/ { print $2 }')
rpub=$(echo "$reality" | awk '/PublicKey/ { print $2 }')
xtls="\"security\":\"tls\",\"tlsSettings\":{\"serverName\":\"test.local\",\"certificates\":[{\"certificateFile\":\"$dir/cert.pem\",\"keyFile\":\"$dir/key.pem\"}]"

cat > $dir/xray.json <<EOF
{"log":{"loglevel":"warning"},
 "inbounds":[
  {"listen":"127.0.0.1","port":8443,"protocol":"hysteria","settings":{"version":2,"clients":[{"auth":"hypw","email":"u"}]},
   "streamSettings":{"network":"hysteria",$xtls,"alpn":["h3"]},"hysteriaSettings":{"version":2},"finalmask":{"udp":[{"type":"salamander","settings":{"password":"obfspass"}}]}}},
  {"listen":"127.0.0.1","port":8444,"protocol":"vless","settings":{"clients":[{"id":"$uuid"}],"decryption":"none"},
   "streamSettings":{"network":"ws",$xtls},"wsSettings":{"path":"/ws"}}},
  {"listen":"127.0.0.1","port":8445,"protocol":"vless","settings":{"clients":[{"id":"$uuid"}],"decryption":"none"},
   "streamSettings":{"network":"grpc",$xtls},"grpcSettings":{"serviceName":"svc"}}},
  {"listen":"127.0.0.1","port":8446,"protocol":"trojan","settings":{"clients":[{"password":"trpw"}]},
   "streamSettings":{"network":"raw",$xtls}}},
  {"listen":"127.0.0.1","port":8447,"protocol":"vless","settings":{"clients":[{"id":"$uuid","flow":"xtls-rprx-vision"}],"decryption":"none"},
   "streamSettings":{"network":"raw","security":"reality","realitySettings":{"dest":"www.microsoft.com:443","serverNames":["www.microsoft.com"],"privateKey":"$rpriv","shortIds":["ab12"]}}}
 ],
 "outbounds":[{"protocol":"freedom"}]}
EOF
"$xray" run -c $dir/xray.json > $dir/xray.log 2>&1 &
xray_pid=$!

cat > $dir/server.json <<EOF
{"log":{"level":"warn"},"inbounds":[{"type":"tuic","listen":"127.0.0.1","listen_port":8448,"users":[{"uuid":"$uuid","password":"tupw"}],"congestion_control":"bbr",
 "tls":{"enabled":true,"server_name":"test.local","certificate_path":"$dir/cert.pem","key_path":"$dir/key.pem","alpn":["h3"]}}],"outbounds":[{"type":"direct"}]}
EOF
sing-box run -c $dir/server.json > $dir/server.log 2>&1 &
server_pid=$!

we1ssconnect import "hysteria2://hypw@127.0.0.1:8443/?sni=test.local&insecure=1&obfs=salamander&obfs-password=obfspass&fp=chrome#HY2
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

# Every server answered above, so a fresh delay test must give each of them a positive delay.
we1ssconnect ping > $dir/ping.json
for name in HY2 WS GRPC TROJAN REALITY TUIC; do
	id=$(id_of $name)
	d=$(ucode -e "import { readfile } from 'fs'; print(json(readfile('$dir/ping.json')).delays['$id'] ?? -1);")
	if [ "$d" -gt 0 ] 2> /dev/null; then pass "$name has a delay ($d ms)"; else fail "$name has a delay (got $d)"; fi
done

kill $client_pid $server_pid $xray_pid 2> /dev/null
if [ "$fails" -gt 0 ]; then
	echo "--- ping.json"; cat $dir/ping.json
	echo "--- client.log"; grep -v 'inbound connection' $dir/client.log | tail -n 30
	echo "--- xray.log"; tail -n 20 $dir/xray.log
	echo "--- server.log"; tail -n 20 $dir/server.log
fi
echo "protocols: $fails failed"
[ "$fails" -eq 0 ]
