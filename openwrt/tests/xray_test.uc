import { test, eq, ok, done } from 't';
import { writefile, popen, access } from 'fs';
import * as xray from 'we1ssconnect.xray';
import { build } from 'we1ssconnect.singbox';
import { parse } from 'we1ssconnect.links';

const XRAY = getenv('WE1SS_TEST_ROOT') + '/.xray/xray';

const CFG = {
	mode: 'selective', selected: 'auto',
	urltest: { url: 'https://www.gstatic.com/generate_204', interval: '3m', tolerance: 50 },
	dns: { type: 'doh', server: 'https://dns.google/dns-query', bootstrap: '77.88.8.8', direct: '77.88.8.8' },
	ipv6: false, lan_proxy: { enabled: false, port: 2080 }, block_quic: false, fragment: false, force_chrome_fp: false,
	lists: { update_interval: '1d', via_tunnel: false }, log_level: 'warn', groups: [], devices: [],
	rules: [{ id: 'r', name: 'All', action: 'proxy', target: 'auto', domains: ['example.org'] }],
	clash: { port: 9090, secret: 'test' }, cache_path: '/tmp/we1ss-test-cache.db',
};

function server(id, link) {
	const r = parse(link);
	return { id, name: r.name, source: 'manual', ok: r.ok, outbound: r.outbound };
}

const UUID = '11111111-2222-3333-4444-555555555555';
const PBK = 'Q8m3zCqfwrUJ8Ruoz9SWzYwxXbj4MVYeBhMKXpZ0EjE';
const DATA = { subscriptions: {}, servers: [
	server('a1', `vless://${UUID}@fi.example.com:443?type=tcp&security=reality&pbk=${PBK}&sid=ab12&sni=www.microsoft.com&fp=firefox&flow=xtls-rprx-vision#FI`),
	server('g2', `trojan://pw@se.example.com:443?type=grpc&serviceName=svc&security=reality&pbk=${PBK}&sni=www.apple.com#SE`),
	server('c3', 'vless://11111111-2222-3333-4444-555555555555@de.example.com:443?type=ws&path=%2Fws&security=tls&sni=de.example.com#DE'),
]};

function run(cmd) {
	const p = popen(cmd + ' 2>&1');
	const out = trim(p.read('all') ?? '');
	return [p.close(), out];
}

function find(list, tag) {
	for (let x in list)
		if (x.tag == tag)
			return x;
	return null;
}

test('REALITY servers go through Xray, the rest stay in sing-box', () => {
	const xr = xray.build(CFG, DATA.servers);
	eq(xr.ports, { a1: 10900, g2: 10901 });
	eq(find(xr.config.outbounds, 'out-a1'), { tag: 'out-a1', protocol: 'vless',
		settings: { vnext: [{ address: 'fi.example.com', port: 443, users: [{ id: UUID, flow: 'xtls-rprx-vision', encryption: 'none' }] }] },
		streamSettings: { network: 'raw', security: 'reality',
			realitySettings: { serverName: 'www.microsoft.com', fingerprint: 'firefox', publicKey: PBK, shortId: 'ab12' },
			sockopt: { mark: 255, domainStrategy: 'UseIPv4' } } });
	eq(find(xr.config.outbounds, 'out-g2').streamSettings.grpcSettings, { serviceName: 'svc' });
	eq(xr.config.routing.rules[1], { type: 'field', inboundTag: ['in-g2'], outboundTag: 'out-g2' });
	if (access(XRAY, 'x')) {
		writefile('/tmp/we1ss-xray.json', sprintf('%J', xr.config));
		eq(run(`${XRAY} run -test -c /tmp/we1ss-xray.json`)[0], 0, 'xray run -test');
	}
	else
		ok(false, `no Xray at ${XRAY} to check the config with`);

	const c = build(CFG, DATA, xr.ports).config;
	eq(find(c.outbounds, 's-a1'), { type: 'socks', tag: 's-a1', server: '127.0.0.1', server_port: 10900, version: '5' });
	eq(find(c.outbounds, 's-c3').type, 'vless', 'not REALITY, so sing-box keeps it');
	eq(find(c.outbounds, 'auto').outbounds, ['s-a1', 's-g2', 's-c3'], 'the balancer still sees every server');
	writefile('/tmp/we1ss-check.json', sprintf('%J', c));
	eq(run('sing-box check -c /tmp/we1ss-check.json'), [0, '']);
});

test('no REALITY servers, no Xray', () => {
	eq(xray.build(CFG, [DATA.servers[2]]), null);
});

test('versions compare by number, not as text', () => {
	eq(map(['26.10.21', '26.3.27', '26.3.9', '25.12.8', '27.1.1', '26.3', null], xray.version_ok),
		[true, true, false, false, true, false, false]);
});

done();
