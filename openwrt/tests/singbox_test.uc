import { test, eq, ok, done } from 't';
import { writefile, popen } from 'fs';
import { build } from 'we1ssconnect.singbox';
import { parse } from 'we1ssconnect.links';

function settings(extra) {
	return {
		mode: 'selective', selected: 'auto',
		urltest: { url: 'https://www.gstatic.com/generate_204', interval: '3m', tolerance: 50 },
		dns: { type: 'doh', server: 'https://dns.google/dns-query', bootstrap: '77.88.8.8', direct: '77.88.8.8' },
		ipv6: false, lan_proxy: { enabled: false, port: 2080 }, block_quic: false,
		fragment: false, force_chrome_fp: false,
		lists: { update_interval: '1d', via_tunnel: false },
		log_level: 'warn', groups: [], rules: [], devices: [],
		clash: { port: 9090, secret: 'test' }, cache_path: '/tmp/we1ss-test-cache.db',
		...extra,
	};
}

function server(id, link) {
	const r = parse(link);
	return { id, name: r.name, source: 'manual', ok: r.ok, outbound: r.outbound, endpoint: r.endpoint };
}

const DATA = { subscriptions: {}, servers: [
	server('a1', 'vless://11111111-2222-3333-4444-555555555555@fi.example.com:443?type=tcp&security=reality&pbk=Q8m3zCqfwrUJ8Ruoz9SWzYwxXbj4MVYeBhMKXpZ0EjE&sid=ab12&sni=www.microsoft.com&fp=firefox&flow=xtls-rprx-vision#FI'),
	server('b2', 'hysteria2://pw@nl.example.com:443/?sni=nl.example.com#NL'),
	server('c3', 'trojan://pw@de.example.com:443?type=ws&path=%2Fws&sni=de.example.com#DE'),
	server('w4', 'wireguard://cGFkcGFkcGFkcGFkcGFkcGFkcGFkcGFkcGFkcGFkcGE%3D@wg.example.com:51820?publickey=cHVicHVicHVicHVicHVicHVicHVicHVicHVicHVicHU%3D&address=10.0.0.2%2F32#WG'),
	{ id: 'x5', name: 'XH', source: 'manual', ok: false, reason: 'xhttp transport is not supported by sing-box' },
]};

// Every generated config must load in the sing-box of this OpenWrt release.
function check(config, what) {
	const file = '/tmp/we1ss-check.json';
	writefile(file, sprintf('%J', config));
	const p = popen(`sing-box check -c ${file} 2>&1`);
	const out = trim(p.read('all'));
	eq([p.close(), out], [0, ''], `sing-box check: ${what}`);
}

function find(list, tag) {
	for (let x in list)
		if (x.tag == tag)
			return x;
	return null;
}

test('sing-box check rejects a broken config', () => {
	writefile('/tmp/we1ss-bad.json', '{"outbounds":[{"type":"nope","tag":"x"}]}');
	const p = popen('sing-box check -c /tmp/we1ss-bad.json 2>&1');
	p.read('all');
	ok(p.close() != 0);
});

test('selective mode: lists through the tunnel, the rest direct', () => {
	const cfg = settings({ rules: [
		{ id: 'r1', name: 'YouTube', action: 'proxy', target: 'auto', services: ['youtube'], domains: ['example.org'] },
		{ id: 'r2', name: 'RU', action: 'direct', presets: ['ru'] },
		{ id: 'r3', name: 'Ads', action: 'block', presets: ['ads'] },
		{ id: 'r4', name: 'Work', action: 'vpn', interface: 'wg0', subnets: ['10.20.0.0/16'] },
	] });
	const r = build(cfg, DATA);
	eq(r.errors, []);
	const c = r.config;
	eq(c.route.final, 'direct');
	eq(find(c.outbounds, 'auto').outbounds, ['s-a1', 's-b2', 's-c3', 's-w4'], 'unsupported servers stay out');
	eq(find(c.outbounds, 'main').default, 'auto');
	eq(find(c.outbounds, 'vpn-wg0').bind_interface, 'wg0');
	eq(map(c.endpoints, (e) => e.tag), ['s-w4']);
	eq(map(c.route.rule_set, (s) => s.tag), ['svc-youtube', 'geosite-category-ru', 'geoip-ru', 'geosite-category-ads-all']);
	eq(filter(c.route.rule_set, (s) => s.tag == 'geoip-ru')[0].url, 'https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/rule-set-geoip/geoip-ru.srs', 'presets use the same source as categories');
	ok(index(map(c.route.rules, (x) => x.outbound ?? x.action), 'main') >= 0);
	eq(filter(c.route.rules, (x) => x.ip_cidr), [{ ip_cidr: ['10.20.0.0/16'], outbound: 'vpn-wg0' }]);
	eq(filter(c.dns.rules, (x) => x.server == 'dns-fakeip'), [
		{ rule_set: ['svc-youtube'], query_type: ['A', 'AAAA'], server: 'dns-fakeip' },
		{ domain_suffix: ['example.org'], query_type: ['A', 'AAAA'], server: 'dns-fakeip' },
	]);
	eq(filter(c.dns.rules, (x) => x.server == 'dns-direct'), [
		{ rule_set: ['geosite-category-ru'], server: 'dns-direct' },
		{ domain_suffix: ['ru', 'su', 'xn--p1ai'], server: 'dns-direct' },
	]);
	eq(find(c.dns.servers, 'dns-remote'), { tag: 'dns-remote', type: 'https', server: 'dns.google', domain_resolver: 'dns-bootstrap' });
	check(c, 'selective');
});

test('global mode: everything through the pinned server, DNS through the tunnel', () => {
	const r = build(settings({ mode: 'global', selected: 'c3', dns: { type: 'dot', server: '1.1.1.1', bootstrap: '77.88.8.8', direct: '77.88.8.8' },
		rules: [{ id: 'r1', name: 'RU', action: 'direct', presets: ['ru'] }] }), DATA);
	eq(r.errors, []);
	eq(r.config.route.final, 'main');
	eq(find(r.config.outbounds, 'main').default, 's-c3');
	eq(find(r.config.dns.servers, 'dns-remote'), { tag: 'dns-remote', type: 'tls', server: '1.1.1.1', detour: 'main' });
	eq(filter(r.config.dns.rules, (x) => x.server == 'dns-fakeip'), [], 'global mode hands out no new FakeIPs');
	ok(find(r.config.dns.servers, 'dns-fakeip') != null, 'but still maps cached FakeIPs back to domains');
	check(r.config, 'global');
});

test('devices, groups, LAN proxy, QUIC block, fragment and the chrome fingerprint', () => {
	const r = build(settings({
		groups: [{ id: 'eu', name: 'EU', servers: ['b2', 'c3', 'gone'] }],
		rules: [{ id: 'r1', name: 'Discord', action: 'proxy', target: 'group:eu', services: ['discord'] }],
		devices: [{ name: 'TV', ip: '192.168.1.50', mode: 'tunnel' }, { name: 'Bank PC', ip: '192.168.1.60', mode: 'bypass' }],
		lan_proxy: { enabled: true, port: 2080 }, block_quic: true, fragment: true, force_chrome_fp: true, ipv6: true,
		lists: { update_interval: '12h', via_tunnel: true },
	}), DATA);
	eq(r.errors, []);
	const c = r.config;
	eq(find(c.outbounds, 'auto-eu').outbounds, ['s-b2', 's-c3']);
	eq(find(c.outbounds, 'sel-eu').outbounds, ['auto-eu', 's-b2', 's-c3']);
	eq(filter(c.route.rules, (x) => x.rule_set)[0].outbound, 'sel-eu');
	eq(filter(c.route.rules, (x) => x.source_ip_cidr), [
		{ source_ip_cidr: ['192.168.1.60'], outbound: 'direct' },
		{ source_ip_cidr: ['192.168.1.50'], outbound: 'main' },
	]);
	eq(find(c.inbounds, 'lan-in').listen_port, 2080);
	eq(filter(c.route.rules, (x) => x.port == 443), [{ network: 'udp', port: 443, action: 'reject' }]);
	eq(find(c.outbounds, 's-a1').tls.utls.fingerprint, 'chrome', 'reality gets chrome');
	eq(find(c.outbounds, 's-a1').tls.fragment, null, 'no fragment with reality');
	eq(find(c.outbounds, 's-c3').tls.fragment, true);
	eq(find(c.outbounds, 's-b2').tls.fragment, null, 'no fragment over QUIC');
	eq(c.route.rule_set[0].download_detour, 'main');
	eq(find(c.dns.servers, 'dns-fakeip').inet6_range, 'fc00::/18');
	eq(c.dns.strategy, 'prefer_ipv4');
	check(c, 'devices and groups');
});

test('categories: geosite sets take part in DNS, geoip sets only in routing', () => {
	const r = build(settings({ rules: [{ id: 'r1', name: 'Blocked', action: 'proxy', target: 'auto', categories: ['geosite:ru-blocked', 'geoip:telegram'] }] }), DATA);
	eq(r.errors, []);
	const c = r.config;
	eq(map(c.route.rule_set, (s) => [s.tag, s.url]), [
		['geosite-ru-blocked', 'https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/rule-set-geosite/geosite-ru-blocked.srs'],
		['geoip-telegram', 'https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/rule-set-geoip/geoip-telegram.srs'],
	]);
	eq(filter(c.route.rules, (x) => x.rule_set), [
		{ rule_set: ['geosite-ru-blocked'], outbound: 'main' },
		{ rule_set: ['geoip-telegram'], outbound: 'main' },
	]);
	eq(filter(c.dns.rules, (x) => x.rule_set), [{ rule_set: ['geosite-ru-blocked'], query_type: ['A', 'AAAA'], server: 'dns-fakeip' }]);
	check(c, 'categories');
});

test('VPN interfaces alone work without any server', () => {
	const r = build(settings({ rules: [{ id: 'r1', name: 'Work', action: 'vpn', interface: 'wg0', domains: ['corp.example'] }] }), { servers: [], subscriptions: {} });
	eq(r.errors, []);
	eq(find(r.config.outbounds, 'main'), null);
	check(r.config, 'vpn only');
});

test('missing targets are reported and skipped', () => {
	const r = build(settings({ selected: 'zz', rules: [
		{ id: 'r1', name: 'One', action: 'proxy', target: 'group:nope', domains: ['a.example'] },
		{ id: 'r2', name: 'Two', action: 'proxy', target: 'server:x5', domains: ['b.example'] },
		{ id: 'r3', name: 'Three', action: 'vpn', domains: ['c.example'] },
	] }), DATA);
	eq(r.errors, [
		'selected server zz is gone; using Auto',
		'rule One: target group:nope is not available',
		'rule Two: target server:x5 is not available',
		'rule Three: no interface',
	]);
	eq(filter(r.config.route.rules, (x) => x.domain_suffix), []);
	check(r.config, 'with errors');
	eq(build(settings({ mode: 'global' }), { servers: [], subscriptions: {} }).errors, ['global mode needs at least one server']);
});

done();
