import { test, eq, ok, done } from 't';
import { normalize } from 'we1ssconnect.config';
import { readfile, writefile } from 'fs';
import { parse_plain, is_rule_set, resolve, srs_cidrs } from 'we1ssconnect.lists';

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

test('srs_cidrs reads the subnets of a rule-set compiled by this sing-box', () => {
	writefile('/tmp/we1ss-rs.json', '{"version":2,"rules":[{"ip_cidr":["1.2.3.0/24","5.6.0.0/16"]},{"domain_suffix":["example.com"]}]}');
	eq(system('sing-box rule-set compile /tmp/we1ss-rs.json -o /tmp/we1ss-rs.srs'), 0);
	eq(srs_cidrs(readfile('/tmp/we1ss-rs.srs')), ['1.2.3.0/24', '5.6.0.0/16']);
	eq(srs_cidrs('not a rule-set'), []);
});

test('categories come from their own list and from the domain and subnet fields', () => {
	const r = normalize([{ '.type': 'rule', '.name': 'r1', name: 'Blocked', category: ['geosite:RU-Blocked', 'geoip:telegram', 'geosite:google@cn'],
		domain: 'geosite:youtube\nexample.com', subnet: 'geoip:ru 10.0.0.0/8' }], DATA);
	eq(r.cfg.rules[0].categories, ['geosite:ru-blocked', 'geoip:telegram', 'geosite:youtube', 'geoip:ru']);
	eq(r.cfg.rules[0].domains, ['example.com']);
	eq(r.cfg.rules[0].subnets, ['10.0.0.0/8']);
	eq(r.errors, ['rule Blocked: bad category geosite:google@cn']);
});

test('categories become runetfreedom rule-sets; geoip ones of tunnel rules also feed nft', () => {
	let cfg = normalize([
		{ '.type': 'rule', '.name': 'r1', name: 'TG', category: ['geosite:telegram', 'geoip:telegram', 'geosite:no-such-thing'] },
		{ '.type': 'rule', '.name': 'r2', action: 'direct', category: 'geoip:ru' },
	], DATA).cfg;
	let decompiled = [];
	const fetch = (url) => index(url, 'no-such-thing') >= 0 ? null : 'SRS ' + url;
	const cidrs = (content) => {
		push(decompiled, content);
		return index(content, 'geoip-telegram') >= 0 ? ['91.108.4.0/22', '149.154.160.0/20'] : ['5.0.0.0/8'];
	};
	const res = resolve(cfg, fetch, cidrs);
	eq(cfg.rules[0].categories, ['geosite:telegram', 'geoip:telegram'], 'the unknown category is dropped');
	eq(res.missing, ['https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/rule-set-geosite/geosite-no-such-thing.srs']);
	eq(res.route_subnets, ['91.108.4.0/22', '149.154.160.0/20']);
	eq(decompiled, ['SRS https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/rule-set-geoip/geoip-telegram.srs'], 'direct rules need no nft subnets');
});

done();
