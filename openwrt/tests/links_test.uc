import { test, eq, ok, done } from 't';
import { parse, parse_all } from 'we1ssconnect.links';

test('vless reality vision', () => {
	const r = parse('vless://11111111-2222-3333-4444-555555555555@example.com:443?type=tcp&security=reality&pbk=PUBKEY&sid=ab12&sni=www.microsoft.com&fp=firefox&flow=xtls-rprx-vision#%D0%A4%D0%B8%D0%BD%D0%BB%D1%8F%D0%BD%D0%B4%D0%B8%D1%8F');
	eq(r.ok, true);
	eq(r.name, 'Финляндия');
	eq(r.outbound, {
		type: 'vless',
		server: 'example.com',
		server_port: 443,
		uuid: '11111111-2222-3333-4444-555555555555',
		flow: 'xtls-rprx-vision',
		packet_encoding: 'xudp',
		tls: {
			enabled: true,
			server_name: 'www.microsoft.com',
			utls: { enabled: true, fingerprint: 'firefox' },
			reality: { enabled: true, public_key: 'PUBKEY', short_id: 'ab12' },
		},
	});
});

test('vless ws tls with early data and IPv6 host', () => {
	const r = parse('vless://uuid-1@[2001:db8::1]:8443?type=ws&security=tls&path=%2Fws%3Fed%3D2048&host=cdn.example.com&sni=cdn.example.com&alpn=h2%2Chttp%2F1.1&allowInsecure=1#ws');
	eq(r.outbound.server, '2001:db8::1');
	eq(r.outbound.server_port, 8443);
	eq(r.outbound.tls, { enabled: true, server_name: 'cdn.example.com', insecure: true, alpn: ['h2', 'http/1.1'] });
	eq(r.outbound.transport, {
		type: 'ws', path: '/ws', headers: { Host: 'cdn.example.com' },
		max_early_data: 2048, early_data_header_name: 'Sec-WebSocket-Protocol',
	});
});

test('vless grpc, httpupgrade and plain tcp', () => {
	eq(parse('vless://u@h:443?type=grpc&serviceName=svc&security=tls&sni=h#g').outbound.transport, { type: 'grpc', service_name: 'svc' });
	eq(parse('vless://u@h:80?type=httpupgrade&path=%2Fup&host=h2#u').outbound.transport, { type: 'httpupgrade', path: '/up', host: 'h2' });
	const plain = parse('vless://u@h:80?encryption=none#p').outbound;
	eq(plain.tls, null);
	eq(plain.transport, null);
});

test('xhttp and kcp are unsupported by stock sing-box', () => {
	const r = parse('vless://u@h:443?type=xhttp&security=reality&pbk=k#x');
	eq(r.ok, false);
	eq(r.name, 'x');
	eq(r.reason, 'xhttp transport is not supported by sing-box');
	eq(parse('vmess://' + b64enc('{"add":"h","port":"1","id":"u","net":"kcp","ps":"k"}')).reason, 'kcp transport is not supported by sing-box');
});

test('vmess json link', () => {
	const json = '{"v":"2","ps":"VM","add":"vm.example.com","port":"443","id":"uuid-2","aid":"0","scy":"auto","net":"ws","type":"none","host":"vm.example.com","path":"/v","tls":"tls","sni":"vm.example.com","fp":"chrome"}';
	const r = parse('vmess://' + b64enc(json));
	eq(r.name, 'VM');
	eq(r.outbound, {
		type: 'vmess', server: 'vm.example.com', server_port: 443, uuid: 'uuid-2', security: 'auto', alter_id: 0,
		packet_encoding: 'xudp',
		tls: { enabled: true, server_name: 'vm.example.com', utls: { enabled: true, fingerprint: 'chrome' } },
		transport: { type: 'ws', path: '/v', headers: { Host: 'vm.example.com' } },
	});
});

test('trojan defaults to tls with the host as server name', () => {
	const r = parse('trojan://p%40ss@tr.example.com:443#tr');
	eq(r.outbound, { type: 'trojan', server: 'tr.example.com', server_port: 443, password: 'p@ss', tls: { enabled: true, server_name: 'tr.example.com' } });
});

test('shadowsocks SIP002, legacy and 2022', () => {
	eq(parse('ss://' + b64enc('aes-256-gcm:secret') + '@1.2.3.4:8388#ss').outbound,
		{ type: 'shadowsocks', server: '1.2.3.4', server_port: 8388, method: 'aes-256-gcm', password: 'secret' });
	eq(parse('ss://' + b64enc('chacha20-ietf-poly1305:pw@5.6.7.8:443') + '#old').outbound,
		{ type: 'shadowsocks', server: '5.6.7.8', server_port: 443, method: 'chacha20-ietf-poly1305', password: 'pw' });
	const slashy = 'aes-128-gcm:??>>';
	ok(index(b64enc(slashy), '/') >= 0, 'the fixture really has a slash in its base64');
	eq(parse('ss://' + b64enc(slashy) + '@h:3#n').outbound.password, '??>>');
	eq(parse('ss://' + b64enc(slashy + '@h:2') + '#legacy').outbound.server_port, 2);
	eq(parse('ss://2022-blake3-aes-128-gcm:a2V5%3D@h:1#n').outbound.password, 'a2V5=');
	eq(parse('ss://' + b64enc('aes-128-gcm:pw') + '@h:1?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dx.com#o').outbound,
		{ type: 'shadowsocks', server: 'h', server_port: 1, method: 'aes-128-gcm', password: 'pw', plugin: 'obfs-local', plugin_opts: 'obfs=http;obfs-host=x.com' });
});

test('hysteria2 with obfs and port hopping', () => {
	const r = parse('hysteria2://user%3Apass@hy.example.com:443/?sni=hy.example.com&insecure=1&obfs=salamander&obfs-password=ob&mport=20000-30000#hy');
	eq(r.outbound, {
		type: 'hysteria2', server: 'hy.example.com', server_port: 443, password: 'user:pass',
		server_ports: ['20000:30000'],
		obfs: { type: 'salamander', password: 'ob' },
		tls: { enabled: true, server_name: 'hy.example.com', insecure: true, alpn: ['h3'] },
	});
	eq(parse('hy2://pw@h:1#x').outbound.type, 'hysteria2');
});

test('tuic', () => {
	eq(parse('tuic://uuid-3:pw@tu.example.com:443?congestion_control=bbr&alpn=h3&sni=tu.example.com&udp_relay_mode=native#t').outbound, {
		type: 'tuic', server: 'tu.example.com', server_port: 443, uuid: 'uuid-3', password: 'pw',
		congestion_control: 'bbr', udp_relay_mode: 'native',
		tls: { enabled: true, server_name: 'tu.example.com', alpn: ['h3'] },
	});
});

test('wireguard becomes an endpoint', () => {
	const r = parse('wireguard://PRIV%3D@wg.example.com:51820?publickey=PUB%3D&address=10.0.0.2%2F32%2Cfd00%3A%3A2%2F128&mtu=1280&reserved=1%2C2%2C3#wg');
	eq(r.endpoint, true);
	eq(r.outbound, {
		type: 'wireguard', address: ['10.0.0.2/32', 'fd00::2/128'], private_key: 'PRIV=', mtu: 1280,
		peers: [{ address: 'wg.example.com', port: 51820, public_key: 'PUB=', allowed_ips: ['0.0.0.0/0', '::/0'], reserved: [1, 2, 3] }],
	});
});

test('socks and anytls', () => {
	eq(parse('socks://' + b64enc('me:pw') + '@s.example.com:1080#s').outbound,
		{ type: 'socks', server: 's.example.com', server_port: 1080, version: '5', username: 'me', password: 'pw' });
	eq(parse('anytls://pw@a.example.com:443?sni=a.example.com#a').outbound,
		{ type: 'anytls', server: 'a.example.com', server_port: 443, password: 'pw', tls: { enabled: true, server_name: 'a.example.com' } });
});

test('names fall back to type and address; bad links explain why', () => {
	eq(parse('trojan://pw@h.example.com:443').name, 'trojan h.example.com:443');
	eq(parse('vless://u@h').reason, 'missing port');
	eq(parse('foo://x').reason, 'unknown link type foo');
	eq(parse('https://t.me/proxy?server=x').reason, 'unknown link type https');
});

test('parse_all reads plain and base64 bodies and skips blank lines', () => {
	const body = 'trojan://pw@a:1#one\r\n\r\nvless://u@b:2?type=xhttp#two\nnot a link\n';
	const plain = parse_all(body);
	eq(map(plain, (r) => [r.ok, r.name]), [[true, 'one'], [false, 'two'], [false, 'not a link']]);
	eq(map(parse_all(b64enc(body)), (r) => r.name), ['one', 'two', 'not a link']);
	eq(map(parse_all(replace(replace(b64enc('trojan://pw@a:1#u'), /\+/g, '-'), /=+$/, '')), (r) => r.name), ['u']);
});

done();
