'use strict';
'require baseclass';

// Routing rules as text, one condition per line, to and from the uci rule sections.
// No DOM here: openwrt/tests/rules_test.mjs runs this file in Node.

// What sing-box sniffs; config.uc accepts the same names.
const PROTOCOLS = ['http', 'tls', 'quic', 'stun', 'dns', 'bittorrent', 'dtls', 'ssh', 'rdp', 'ntp'];
const CATEGORY = /^[a-z0-9][a-z0-9._!-]*$/;
const DOMAIN = /^([a-z0-9_-]+\.)+[a-z0-9-]+$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;
const IPV6 = /^[0-9a-f]*:[0-9a-f:.]*(\/(\d{1,3}))?$/;
const IFACE = /^[A-Za-z0-9_.@-]+$/;
const RULE = /^(!)?\s*([a-z]+)\s*\((.*?)\)\s*->\s*([a-z]+)\s*(?:\((.*)\))?$/i;
// lists.uc downloads categories from here (CATEGORY_BASE, category_url).
const CATEGORY_BASE = 'https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/';
const LISTS = ['protocol', 'service', 'preset', 'category', 'domain', 'subnet', 'remote_list'];

function isIp(v) {
	const m = IPV4.exec(v);
	if (m)
		return m.slice(1, 5).every((o) => +o <= 255) && (m[6] == null || +m[6] <= 32);
	const m6 = IPV6.exec(v);
	return !!m6 && (m6[2] == null || +m6[2] <= 128);
}

// uci keeps domains and subnets as text (and older configs as lists); the rest as lists.
function entries(v) {
	return [].concat(v || []).join('\n').split(/[\s,]+/).filter((x) => x);
}

function categoryUrl(category) {
	const [kind, name] = category.split(':');
	return `${CATEGORY_BASE}rule-set-${kind}/${kind}-${name}.srs`;
}

function blank(over) {
	const r = { enabled: true, name: '', action: 'proxy', target: '', interface: '' };
	LISTS.forEach((k) => r[k] = []);
	return Object.assign(r, over);
}

// A group wins over a server of the same name, as in the target list of the form.
function resolve(name, ctx) {
	if (/^(group|server):/.test(name))
		return { target: name };
	if (name.toLowerCase() == 'auto')
		return { target: 'auto' };
	const groups = (ctx.groups || []).filter((g) => g.name == name);
	if (groups.length == 1)
		return { target: 'group:' + groups[0].sid };
	const servers = (ctx.servers || []).filter((s) => s.name == name);
	if (!groups.length && servers.length == 1)
		return { target: 'server:' + servers[0].id };
	if (groups.length || servers.length)
		return { error: _('Several servers or groups are named %s; use its id').format(name) };
	return { error: _('No server or group named %s').format(name) };
}

function nameOf(target, ctx) {
	let name = null;
	if (target.startsWith('group:'))
		name = ((ctx.groups || []).find((g) => 'group:' + g.sid == target) || {}).name;
	else if (target.startsWith('server:'))
		name = ((ctx.servers || []).find((s) => 'server:' + s.id == target) || {}).name;
	if (!name || /[()]/.test(name) || name.trim() != name || /^(group|server):/.test(name) || name.toLowerCase() == 'auto')
		return target;
	return resolve(name, ctx).target == target ? name : target;
}

// condition(value) -> [uci list, stored value] or { error }.
function condition(kind, value, ctx) {
	const v = value.trim(), lc = v.toLowerCase();
	switch (kind) {
	case 'domain':
		if (lc.startsWith('geosite:'))
			return CATEGORY.test(lc.slice(8)) ? ['category', lc] : { error: _('Not a category name: %s').format(v) };
		return DOMAIN.test(lc) ? ['domain', lc] : { error: _('Not a domain: %s').format(v) };
	case 'geoip': {
		const name = lc.replace(/^geoip:/, '');
		return CATEGORY.test(name) ? ['category', 'geoip:' + name] : { error: _('Not a category name: %s').format(v) };
	}
	case 'ip':
		return isIp(lc) ? ['subnet', lc] : { error: _('Not an IP address or subnet: %s').format(v) };
	case 'service':
		return (ctx.services || []).includes(lc) ? ['service', lc] : { error: _('Unknown service %s').format(v) };
	case 'preset':
		return (ctx.presets || []).includes(lc) ? ['preset', lc] : { error: _('Unknown preset %s').format(v) };
	case 'list':
		return /^https?:\/\/\S+$/i.test(v) ? ['remote_list', v] : { error: _('Not an http(s) URL: %s').format(v) };
	case 'protocol':
		return PROTOCOLS.includes(lc) ? ['protocol', lc] : { error: _('Unknown protocol %s').format(v) };
	}
	return { error: _('Unknown condition %s').format(kind) };
}

// action(target) -> the section fields it sets, or { error }.
function action(kind, arg, ctx) {
	const a = kind.toLowerCase(), t = arg == null ? null : arg.trim();
	if (a == 'direct' || a == 'block')
		return t == null ? { action: a, target: '', interface: '' } : { error: _('%s takes no server').format(a) };
	if (a == 'proxy') {
		const r = t == null || t == '' ? { target: 'auto' } : resolve(t, ctx);
		return r.error ? r : { action: 'proxy', target: r.target, interface: '' };
	}
	if (a == 'vpn')
		return t && IFACE.test(t) ? { action: 'vpn', target: '', interface: t } : { error: _('vpn needs an interface, such as vpn(wg0)') };
	return { error: _('Unknown action %s').format(kind) };
}

function parse(text, ctx) {
	const out = { mode: null, rules: [], errors: [], warnings: [], categories: [] };
	let comments = [], hadRules = false, cur = null;
	const tunnelProtocols = [];

	(text || '').split(/\r?\n/).forEach((raw, i) => {
		const line = i + 1, t = raw.trim();
		const fail = (msg) => out.errors.push({ line, msg });
		if (!t) {
			comments = [], hadRules = false, cur = null;
			return;
		}
		if (t.startsWith('#')) {
			if (hadRules)
				comments = [], hadRules = false, cur = null;
			comments.push(t.replace(/^#+\s*/, ''));
			return;
		}
		const d = /^default\s*:\s*(\S*)$/i.exec(t);
		if (d) {
			const v = d[1].toLowerCase();
			if (out.mode != null)
				fail(_('Only one default line is allowed'));
			else if (v == 'direct' || v == 'proxy')
				out.mode = v == 'proxy' ? 'global' : 'selective';
			else
				fail(_('default is direct or proxy'));
			return;
		}
		const m = RULE.exec(t);
		if (!m)
			return fail(/->\s*[a-z]+\s*(\([^)]*\))?\s*#/i.test(t) ? _('Put comments on a line of their own') : _('Expected condition(value)->action'));
		const c = condition(m[2].toLowerCase(), m[3], ctx);
		if (c.error)
			return fail(c.error);
		const a = action(m[4], m[5], ctx);
		if (a.error)
			return fail(a.error);

		const enabled = !m[1], name = comments.join(' ');
		const same = cur && cur.enabled == enabled && cur.action == a.action && cur.target == a.target && cur.interface == a.interface;
		if (!same) {
			cur = blank(Object.assign({ enabled, name }, a));
			out.rules.push(cur);
		}
		if (!cur[c[0]].includes(c[1]))
			cur[c[0]].push(c[1]);
		if (c[0] == 'category')
			out.categories.push({ line, category: c[1] });
		if (c[0] == 'protocol' && (a.action == 'proxy' || a.action == 'vpn'))
			tunnelProtocols.push(line);
		hadRules = true;
	});

	if ((out.mode || ctx.mode || 'selective') != 'global')
		tunnelProtocols.forEach((line) => out.warnings.push({ line,
			msg: _('In selective mode only traffic matched by domain or IP rules reaches the tunnel, so this rule catches almost nothing') }));
	return out;
}

function serialize(mode, rules, ctx) {
	const lines = [mode == 'global' ? 'default: proxy' : 'default: direct'];
	const gap = () => lines[lines.length - 1] != '' && lines.push('');
	let prev = null;
	(rules || []).forEach((r) => {
		const enabled = r.enabled !== false && r.enabled !== '0';
		const act = r.action || 'proxy', target = act == 'proxy' ? (r.target || 'auto') : '', iface = act == 'vpn' ? (r.interface || '') : '';
		const name = r.name || '';
		const merges = prev && prev.name == name && prev.enabled == enabled && prev.act == act && prev.target == target && prev.iface == iface;
		if (!prev || prev.name != name || merges) {
			gap();
			if (name)
				lines.push('# ' + name);
		}
		prev = { name, enabled, act, target, iface };

		let tail = act;
		if (act == 'proxy' && target != 'auto')
			tail = 'proxy(' + nameOf(target, ctx) + ')';
		else if (act == 'vpn')
			tail = 'vpn(' + iface + ')';
		const emit = (cond) => lines.push((enabled ? '' : '!') + cond + '->' + tail);
		entries(r.protocol).forEach((v) => emit('protocol(' + v + ')'));
		entries(r.service).forEach((v) => emit('service(' + v + ')'));
		entries(r.preset).forEach((v) => emit('preset(' + v + ')'));
		entries(r.category).forEach((v) => emit(v.startsWith('geoip:') ? 'geoip(' + v.slice(6) + ')' : 'domain(' + v + ')'));
		entries(r.domain).forEach((v) => emit('domain(' + v + ')'));
		entries(r.subnet).forEach((v) => emit('ip(' + v + ')'));
		[].concat(r.remote_list || []).forEach((v) => emit('list(' + v + ')'));
	});
	return lines.join('\n') + '\n';
}

return baseclass.extend({ PROTOCOLS, LISTS, entries, categoryUrl, parse, serialize });
