import { test, eq, ok, done } from 't';
import { normalize } from 'we1ssconnect.config';
import { parse_plain, is_rule_set, resolve } from 'we1ssconnect.lists';

const DATA = { subscriptions: {}, servers: [
	{ id: 'a', name: 'Finland 1', source: 'sub1', ok: true },
	{ id: 'b', name: 'Germany', source: 'sub1', ok: true },
	{ id: 'c', name: 'Finland 2', source: 'sub2', ok: true },
	{ id: 'd', name: 'Finland XHTTP', source: 'sub1', ok: false },
	{ id: 'm', name: 'Mine', source: 'manual', ok: true },
]};

test('defaults when only the settings section exists', () => {
	const r = normalize([{ '.type': 'settings', '.name': 'main', enabled: '1' }], DATA);
	eq(r.errors, []);
	eq(r.cfg.enabled, true);
	eq(r.cfg.mode, 'selective');
	eq(r.cfg.ifaces, ['br-lan']);
	eq(r.cfg.dns, { type: 'doh', server: '1.1.1.1', bootstrap: '77.88.8.8', direct: '77.88.8.8' });
	eq(r.cfg.urltest.tolerance, 50);
	eq([r.cfg.force_chrome_fp, r.cfg.intercept_dns, r.cfg.exclude_ntp, r.cfg.fragment], [true, true, true, false]);
});

test('groups take subscriptions, explicit servers and a name filter', () => {
	const r = normalize([
		{ '.type': 'group', '.name': 'fi', name: 'Finland', subscription: ['sub1', 'sub2'], filter: 'finland' },
		{ '.type': 'group', '.name': 'mix', server: ['m', 'b'] },
		{ '.type': 'group', '.name': 'bad', subscription: 'sub1', filter: '(' },
	], DATA);
	eq(r.cfg.groups[0], { id: 'fi', name: 'Finland', servers: ['a', 'c'], selected: null });
	eq(r.cfg.groups[1].servers, ['b', 'm'], 'store order, unusable servers out');
	eq(r.errors, ['group bad: bad filter (']);
});

test('rules keep file order; disabled rules and incomplete devices drop out', () => {
	const r = normalize([
		{ '.type': 'rule', '.name': 'r1', name: 'YouTube', service: ['youtube'], domain: 'a.example\nb.example, c.example' },
		{ '.type': 'rule', '.name': 'r2', enabled: '0', name: 'Off' },
		{ '.type': 'rule', '.name': 'r3', action: 'direct', preset: 'ru', subnet: ['10.0.0.0/8 172.16.0.0/12'] },
		{ '.type': 'device', '.name': 'd1', name: 'TV', ip: '192.168.1.50', mode: 'tunnel' },
		{ '.type': 'device', '.name': 'd2', name: 'No IP', mode: 'tunnel' },
		{ '.type': 'device', '.name': 'd3', ip: '192.168.1.70', mode: 'default' },
	], DATA);
	eq(map(r.cfg.rules, (x) => x.id), ['r1', 'r3']);
	eq(r.cfg.rules[0].domains, ['a.example', 'b.example', 'c.example']);
	eq([r.cfg.rules[0].action, r.cfg.rules[0].target], ['proxy', 'auto']);
	eq(r.cfg.rules[1].presets, ['ru']);
	eq(r.cfg.rules[1].subnets, ['10.0.0.0/8', '172.16.0.0/12']);
	eq(r.cfg.devices, [{ name: 'TV', ip: '192.168.1.50', mode: 'tunnel' }]);
});

test('plain lists: domains, CIDRs, comments and common prefixes', () => {
	eq(parse_plain('# list\nexample.com\n*.cdn.example\n.dot.example\ndomain:pre.example\nfull:full.example\nDOMAIN-SUFFIX,clash.example\n1.2.3.4\n10.0.0.0/8 # lan\n2001:db8::/32\nnot_a_domain\n'), {
		domains: ['example.com', 'cdn.example', 'dot.example', 'pre.example', 'full.example', 'clash.example'],
		cidrs: ['1.2.3.4/32', '10.0.0.0/8', '2001:db8::/32'],
	});
	eq([is_rule_set('https://x/a.srs'), is_rule_set('https://x/a.json?raw=1'), is_rule_set('https://x/a.lst')], [true, true, false]);
});

test('resolve inlines plain lists and collects the subnets nft must intercept', () => {
	let cfg = normalize([
		{ '.type': 'rule', '.name': 'r1', name: 'TG', service: ['telegram', 'youtube'], subnet: '5.5.5.0/24', remote_list: ['https://x/my.lst', 'https://x/set.srs'] },
		{ '.type': 'rule', '.name': 'r2', action: 'direct', remote_list: 'https://x/direct.txt' },
		{ '.type': 'rule', '.name': 'r3', name: 'Gone', remote_list: 'https://x/missing.txt' },
	], DATA).cfg;
	let asked = [];
	const fetch = (url) => {
		push(asked, url);
		if (index(url, 'telegram.lst') >= 0) return '149.154.160.0/20\n91.108.4.0/22\n';
		if (index(url, 'my.lst') >= 0) return 'mine.example\n6.6.6.6\n';
		if (index(url, 'direct.txt') >= 0) return '7.7.7.0/24\n';
		return null;
	};
	const res = resolve(cfg, fetch);
	eq(cfg.rules[0].remote_lists, ['https://x/set.srs'], 'rule-sets stay for sing-box');
	eq(cfg.rules[0].inline_domains, ['mine.example']);
	eq(res.route_subnets, ['5.5.5.0/24', '6.6.6.6/32', '149.154.160.0/20', '91.108.4.0/22']);
	ok(index(asked, 'https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Subnets/IPv4/youtube.lst') < 0, 'youtube has no subnet list');
	eq(cfg.rules[1].inline_subnets, ['7.7.7.0/24'], 'direct rules keep their CIDRs for sing-box');
	eq(res.missing, ['https://x/missing.txt']);
});

done();
