import { test, eq, ok, done } from 't';
import { writefile, popen } from 'fs';
import { render, route_commands } from 'we1ssconnect.nft';

function base(extra) {
	return { mode: 'selective', ifaces: ['br-lan'], route_subnets: [], devices: [], intercept_dns: true, exclude_ntp: true, ipv6: false, ...extra };
}

// The kernel's own parser validates the ruleset without applying it.
function nft_check(text, what) {
	writefile('/tmp/we1ss.nft', text);
	const p = popen('nft -c -f /tmp/we1ss.nft 2>&1');
	const out = trim(p.read('all'));
	eq([p.close(), out], [0, ''], `nft -c: ${what}`);
}

function has(text, line) {
	return index(text, line) >= 0;
}

test('selective: FakeIP, listed subnets and DNS go to TPROXY', () => {
	const t = render(base({ route_subnets: ['149.154.160.0/20', '91.108.4.0/22'] }));
	ok(has(t, 'elements = { 149.154.160.0/20, 91.108.4.0/22 }'));
	ok(has(t, 'ip daddr @fakeip4 meta l4proto { tcp, udp } meta mark set 0x00100000 tproxy ip to 127.0.0.1:1602 accept'));
	ok(has(t, 'ip daddr @route4 meta l4proto'));
	ok(has(t, 'th dport 53'), 'hard-coded DNS servers are intercepted');
	ok(has(t, 'udp dport 123 return'));
	ok(!has(t, 'meta nfproto ipv4 meta l4proto'), 'not everything');
	nft_check(t, 'selective');
});

test('the rule order keeps LAN traffic and bypassed devices away from the tunnel', () => {
	const t = render(base({ devices: [{ ip: '192.168.1.50', mode: 'tunnel' }, { ip: '192.168.1.60', mode: 'bypass' }] }));
	const pos = (s) => index(t, s);
	ok(pos('iifname != { "br-lan" } return') < pos('ip daddr @fakeip4 meta'), 'other interfaces first');
	ok(pos('ip daddr @fakeip4 meta') < pos('ip saddr @bypass4 return'), 'FakeIP before the bypass list');
	ok(pos('ip saddr @bypass4 return') < pos('th dport 53'), 'bypassed devices keep their own DNS');
	ok(pos('ip daddr @reserved4 return') < pos('ip saddr @tunnel4'), 'LAN stays direct for tunnel devices');
	nft_check(t, 'devices');
});

test('global mode with IPv6 and several interfaces', () => {
	const t = render(base({ mode: 'global', ipv6: true, ifaces: ['br-lan', 'br-guest'], route_subnets: ['2001:db8::/32'], exclude_ntp: false }));
	ok(has(t, 'iifname != { "br-lan", "br-guest" } return'));
	ok(has(t, 'meta nfproto ipv4 meta l4proto'));
	ok(has(t, 'tproxy ip6 to [::1]:1602'));
	ok(!has(t, 'th dport 53'), 'global mode sends DNS through sing-box anyway');
	ok(!has(t, 'udp dport 123'));
	nft_check(t, 'global v6');
});

test('route commands', () => {
	eq(route_commands(true, false), ['ip rule add fwmark 0x00100000/0x00100000 lookup 105', 'ip route add local 0.0.0.0/0 dev lo table 105']);
	eq(length(route_commands(false, true)), 4);
});

test('nft_check rejects a broken ruleset', () => {
	writefile('/tmp/we1ss-bad.nft', 'table inet x { chain y { nonsense } }');
	const p = popen('nft -c -f /tmp/we1ss-bad.nft 2>&1');
	p.read('all');
	ok(p.close() != 0);
});

done();
