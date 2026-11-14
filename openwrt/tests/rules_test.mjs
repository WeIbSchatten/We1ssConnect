// rules.js: routing rules as text <-> the uci rule sections. Run: node --test openwrt/tests/rules_test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { load } from './lib/luci-shim.mjs';

const rules = load(fileURLToPath(new URL('../luci-app-we1ssconnect/htdocs/luci-static/resources/we1ssconnect/rules.js', import.meta.url)));

const ctx = {
	groups: [{ sid: 'g_fi', name: 'Финляндия' }, { sid: 'g_dup', name: 'Dup' }],
	servers: [{ id: 's1', name: 'NL' }, { id: 's2', name: 'Dup' }, { id: 's3', name: 'DE' }, { id: 's4', name: 'DE' }, { id: 's5', name: 'Odd (beta)' }],
	services: ['youtube', 'telegram', 'russia_inside'],
	presets: ['ru', 'ads'],
};

const R = (over) => ({
	enabled: true, name: '', action: 'proxy', target: '', interface: '',
	protocol: [], service: [], preset: [], category: [], domain: [], subnet: [], remote_list: [], ...over,
});

const OWNER = `default: direct
protocol(bittorrent)->direct

# Домены доступные только внтури РФ
domain(geosite:ru-available-only-inside)->direct

# Заблокированные домены в РФ
domain(geosite:ru-blocked)->proxy
domain(geosite:refilter)->proxy
domain(geosite:antifilter-download-community)->proxy

# Рекламные домены
domain(geosite:category-ads-all)->block

# Домены используемые windows для обновлений
domain(geosite:win-update)->proxy

# Прочие домены используемые windows
domain(geosite:win-extra)->proxy

# Прочие сайты (domain)
domain(animeon.cc)->proxy
domain(shikimori.io)->proxy
domain(mermaidchart.com)->proxy
domain(qbittorrent.org)->proxy

# Прочие сайты (geoip)
geoip(telegram)->proxy
`;

const OWNER_RULES = [
	R({ action: 'direct', protocol: ['bittorrent'] }),
	R({ name: 'Домены доступные только внтури РФ', action: 'direct', category: ['geosite:ru-available-only-inside'] }),
	R({ name: 'Заблокированные домены в РФ', target: 'auto', category: ['geosite:ru-blocked', 'geosite:refilter', 'geosite:antifilter-download-community'] }),
	R({ name: 'Рекламные домены', action: 'block', category: ['geosite:category-ads-all'] }),
	R({ name: 'Домены используемые windows для обновлений', target: 'auto', category: ['geosite:win-update'] }),
	R({ name: 'Прочие домены используемые windows', target: 'auto', category: ['geosite:win-extra'] }),
	R({ name: 'Прочие сайты (domain)', target: 'auto', domain: ['animeon.cc', 'shikimori.io', 'mermaidchart.com', 'qbittorrent.org'] }),
	R({ name: 'Прочие сайты (geoip)', target: 'auto', category: ['geoip:telegram'] }),
];

test('the owner\'s rule list becomes one section per commented block', () => {
	const p = rules.parse(OWNER, ctx);
	assert.deepEqual(p.errors, []);
	assert.equal(p.mode, 'selective');
	assert.deepEqual(p.rules, OWNER_RULES);
	assert.deepEqual(p.categories.map((c) => c.line), [5, 8, 9, 10, 13, 16, 19, 28]);
});

test('every condition and action of the syntax', () => {
	const p = rules.parse([
		'default: proxy',
		'service(youtube)->proxy(Финляндия)',
		'preset(ru)->direct',
		'ip(149.154.160.0/20)->proxy(NL)',
		'ip(2001:db8::/32)->block',
		'list(https://example.com/a.lst)->proxy(group:g_fi)',
		'domain(corp.local)->vpn(wg0)',
		'!domain(ads.example)->block',
	].join('\n'), ctx);
	assert.deepEqual(p.errors, []);
	assert.equal(p.mode, 'global');
	assert.deepEqual(p.rules, [
		R({ target: 'group:g_fi', service: ['youtube'] }),
		R({ action: 'direct', preset: ['ru'] }),
		R({ target: 'server:s1', subnet: ['149.154.160.0/20'] }),
		R({ action: 'block', subnet: ['2001:db8::/32'] }),
		R({ target: 'group:g_fi', remote_list: ['https://example.com/a.lst'] }),
		R({ action: 'vpn', interface: 'wg0', domain: ['corp.local'] }),
		R({ enabled: false, action: 'block', domain: ['ads.example'] }),
	]);
});

test('mistakes are reported with their line and the rule is left out', () => {
	const p = rules.parse([
		'domain(a.example)->fly',
		'service(nope)->proxy',
		'protocol(gopher)->direct',
		'domain(x.example)->proxy(Нет такого)',
		'domain(x.example)->proxy(DE)',
		'domain(bad domain)->proxy',
		'ip(300.1.1.1)->proxy',
		'list(ftp://x)->proxy',
		'domain(geosite:google@cn)->proxy',
		'default: direct',
		'default: proxy',
		'domain(a.example)->proxy # note',
		'whatever',
		'domain(a.example)->direct(NL)',
	].join('\n'), ctx);
	assert.deepEqual(p.rules, []);
	assert.deepEqual(p.errors, [
		{ line: 1, msg: 'Unknown action fly' },
		{ line: 2, msg: 'Unknown service nope' },
		{ line: 3, msg: 'Unknown protocol gopher' },
		{ line: 4, msg: 'No server or group named Нет такого' },
		{ line: 5, msg: 'Several servers or groups are named DE; use its id' },
		{ line: 6, msg: 'Not a domain: bad domain' },
		{ line: 7, msg: 'Not an IP address or subnet: 300.1.1.1' },
		{ line: 8, msg: 'Not an http(s) URL: ftp://x' },
		{ line: 9, msg: 'Not a category name: geosite:google@cn' },
		{ line: 11, msg: 'Only one default line is allowed' },
		{ line: 12, msg: 'Put comments on a line of their own' },
		{ line: 13, msg: 'Expected condition(value)->action' },
		{ line: 14, msg: 'direct takes no server' },
	]);
});

test('a protocol sent to the tunnel in selective mode is warned about', () => {
	assert.deepEqual(rules.parse('default: direct\nprotocol(quic)->proxy', ctx).warnings,
		[{ line: 2, msg: 'In selective mode only traffic matched by domain or IP rules reaches the tunnel, so this rule catches almost nothing' }]);
	assert.deepEqual(rules.parse('default: proxy\nprotocol(quic)->proxy', ctx).warnings, []);
	assert.deepEqual(rules.parse('protocol(quic)->proxy', { ...ctx, mode: 'global' }).warnings, [], 'without a default line the current mode counts');
});

test('printing the owner\'s rules gives text that reads back the same', () => {
	const text = rules.serialize('selective', OWNER_RULES, ctx);
	assert.deepEqual(rules.parse(text, ctx).rules, OWNER_RULES);
	assert.equal(rules.serialize('selective', rules.parse(text, ctx).rules, ctx), text, 'stable after one pass');
	assert.match(text, /^default: direct\n\nprotocol\(bittorrent\)->direct\n\n# Домены доступные только внтури РФ\n/);
});

test('targets print by name when the name reads back to them, otherwise by id', () => {
	const set = [
		R({ target: 'group:g_fi', domain: ['a.example'] }),
		R({ target: 'server:s1', domain: ['b.example'] }),
		R({ target: 'server:s2', domain: ['c.example'] }),
		R({ target: 'server:s3', domain: ['d.example'] }),
		R({ target: 'server:s5', domain: ['e.example'] }),
		R({ target: 'server:zz', domain: ['f.example'] }),
	];
	const text = rules.serialize('global', set, ctx);
	assert.deepEqual(text.split('\n').filter((l) => l.includes('->')), [
		'domain(a.example)->proxy(Финляндия)',
		'domain(b.example)->proxy(NL)',
		'domain(c.example)->proxy(server:s2)',
		'domain(d.example)->proxy(server:s3)',
		'domain(e.example)->proxy(server:s5)',
		'domain(f.example)->proxy(server:zz)',
	]);
	assert.deepEqual(rules.parse(text, ctx).rules, set);
});

test('neighbouring sections with the same name and action stay apart', () => {
	const set = [
		R({ name: 'YouTube', target: 'auto', service: ['youtube'] }),
		R({ name: 'YouTube', target: 'auto', domain: ['youtu.be'] }),
		R({ name: 'YouTube', action: 'direct', domain: ['ytimg.com'] }),
		R({ target: 'auto', domain: ['x.example'] }),
		R({ target: 'auto', domain: ['y.example'] }),
	];
	assert.deepEqual(rules.parse(rules.serialize('selective', set, ctx), ctx).rules, set);
});

test('pasted from Windows, with odd case and spaces', () => {
	const p = rules.parse('Default: Proxy\r\n# Сайты\r\nDomain( Example.COM ) -> PROXY\r\n', ctx);
	assert.deepEqual(p.errors, []);
	assert.equal(p.mode, 'global');
	assert.deepEqual(p.rules, [R({ name: 'Сайты', target: 'auto', domain: ['example.com'] })]);
});

test('empty text: no rules, the mode stays', () => {
	assert.deepEqual(rules.parse('', ctx), { mode: null, rules: [], errors: [], warnings: [], categories: [] });
	assert.equal(rules.serialize('selective', [], ctx), 'default: direct\n');
});

test('old configs: domains and subnets as one string or a uci list print one per line', () => {
	const text = rules.serialize('selective', [
		R({ target: 'auto', domain: 'a.example\nb.example, c.example', subnet: ['10.0.0.0/8 172.16.0.0/12'], service: 'youtube' }),
	], ctx);
	assert.equal(text, 'default: direct\n\nservice(youtube)->proxy\ndomain(a.example)->proxy\ndomain(b.example)->proxy\ndomain(c.example)->proxy\nip(10.0.0.0/8)->proxy\nip(172.16.0.0/12)->proxy\n');
});
