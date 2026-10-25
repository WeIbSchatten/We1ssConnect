// Builds the sing-box config from normalized settings (config.uc) and the server store.
// Pure: no file or network access, so every branch is unit-tested and `sing-box check`ed.

import { category_url } from 'we1ssconnect.lists';

export const TPROXY_PORT = 1602;
export const DNS_LISTEN = '127.0.0.42';
export const SVC_PORT = 2081;
export const ROUTING_MARK = 255;
export const FAKEIP_V4 = '198.18.0.0/15';
export const FAKEIP_V6 = 'fc00::/18';

const ITDOG = 'https://github.com/itdoginfo/allow-domains/releases/latest/download/';

// Community lists of itdoginfo/allow-domains, downloaded by sing-box at runtime.
export const SERVICES = [
	'russia_inside', 'russia_outside', 'ukraine_inside', 'geoblock', 'block', 'porn', 'news', 'anime',
	'youtube', 'hdrezka', 'tiktok', 'google_ai', 'google_play', 'google_meet', 'hodca', 'discord',
	'meta', 'twitter', 'cloudflare', 'cloudfront', 'digitalocean', 'hetzner', 'ovh', 'telegram', 'roblox',
];

// The same categories as the apps' presets, from the same source as the user's geosite:/geoip:.
export const PRESETS = {
	ru: { categories: ['geosite:category-ru', 'geoip:ru'], domain_suffix: ['ru', 'su', 'xn--p1ai'] },
	ads: { categories: ['geosite:category-ads-all'] },
};

export function server_tag(id) {
	return 's-' + id;
};

function dns_remote(cfg, global) {
	const d = cfg.dns;
	let s = { tag: 'dns-remote' };
	if (d.type == 'doh') {
		const m = match(d.server, /^(https:\/\/)?([^\/]+)(\/.*)?$/);
		s.type = 'https';
		s.server = m[2];
		if (m[3] && m[3] != '/dns-query')
			s.path = m[3];
	}
	else {
		s.type = d.type == 'dot' ? 'tls' : 'udp';
		s.server = d.server;
	}
	if (!match(s.server, /^[0-9.]+$/) && index(s.server, ':') < 0)
		s.domain_resolver = 'dns-bootstrap';
	if (global)
		s.detour = 'main';
	return s;
}

function tune_outbound(ob, cfg) {
	let o = { ...ob };
	if (o.tls) {
		o.tls = { ...o.tls };
		if (cfg.force_chrome_fp && (o.tls.utls || o.tls.reality))
			o.tls.utls = { enabled: true, fingerprint: 'chrome' };
		if (cfg.fragment && !o.tls.reality && o.type != 'hysteria2' && o.type != 'tuic')
			o.tls.fragment = true;
	}
	return o;
}

// "auto" → main selector (follows the pinned server); "group:<id>"; "server:<id>".
function resolve_target(target, known) {
	if (!target || target == 'auto')
		return known.main ? 'main' : null;
	if (substr(target, 0, 6) == 'group:')
		return known.groups[substr(target, 6)] ? 'sel-' + substr(target, 6) : null;
	if (substr(target, 0, 7) == 'server:')
		return known.servers[substr(target, 7)] ? server_tag(substr(target, 7)) : null;
	return null;
}

function balanced(tag_auto, tag_sel, members, chosen, cfg) {
	const auto = {
		type: 'urltest', tag: tag_auto, outbounds: members,
		url: cfg.urltest.url, interval: cfg.urltest.interval, tolerance: cfg.urltest.tolerance,
	};
	const sel = {
		type: 'selector', tag: tag_sel, outbounds: [tag_auto, ...members],
		default: (chosen && index(members, chosen) >= 0) ? chosen : tag_auto,
		interrupt_exist_connections: true,
	};
	return [auto, sel];
}

// Returns { config, errors }; errors name settings that point at missing servers or groups.
export function build(cfg, data) {
	const global = cfg.mode == 'global';
	let errors = [], outbounds = [], endpoints = [];
	let known = { main: false, groups: {}, servers: {} };

	let all = [];
	for (let s in data.servers) {
		if (!s.ok)
			continue;
		const ob = { ...tune_outbound(s.outbound, cfg), tag: server_tag(s.id) };
		push(s.endpoint ? endpoints : outbounds, ob);
		push(all, ob.tag);
		known.servers[s.id] = true;
	}

	if (length(all)) {
		const chosen = cfg.selected && cfg.selected != 'auto' ? server_tag(cfg.selected) : null;
		if (chosen && !known.servers[cfg.selected])
			push(errors, `selected server ${cfg.selected} is gone; using Auto`);
		push(outbounds, ...balanced('auto', 'main', all, chosen, cfg));
		known.main = true;
	}
	for (let g in cfg.groups) {
		const members = map(filter(g.servers, (id) => known.servers[id]), server_tag);
		if (!length(members)) {
			push(errors, `group ${g.name} has no usable servers`);
			continue;
		}
		push(outbounds, ...balanced('auto-' + g.id, 'sel-' + g.id, members, g.selected ? server_tag(g.selected) : null, cfg));
		known.groups[g.id] = true;
	}

	push(outbounds, { type: 'direct', tag: 'direct' });
	let vpn_seen = {};
	for (let r in cfg.rules)
		if (r.action == 'vpn' && r.interface && !vpn_seen[r.interface]) {
			vpn_seen[r.interface] = true;
			push(outbounds, { type: 'direct', tag: 'vpn-' + r.interface, bind_interface: r.interface });
		}

	let rule_sets = [], rs_seen = {};
	const download_detour = (cfg.lists.via_tunnel && known.main) ? 'main' : null;
	function add_rule_set(tag, url) {
		if (!rs_seen[tag]) {
			rs_seen[tag] = true;
			let rs = { type: 'remote', tag, format: match(url, /\.json(\?|$)/) ? 'source' : 'binary', url, update_interval: cfg.lists.update_interval };
			if (download_detour)
				rs.download_detour = download_detour;
			push(rule_sets, rs);
		}
		return tag;
	}

	let route_rules = [
		{ action: 'sniff' },
		{ protocol: 'dns', action: 'hijack-dns' },
		{ inbound: ['dns-in'], action: 'hijack-dns' },
	];
	if (known.main)
		push(route_rules, { inbound: ['svc-in'], outbound: 'main' });
	push(route_rules, { ip_is_private: true, outbound: 'direct' });
	if (cfg.block_quic)
		push(route_rules, { network: 'udp', port: 443, action: 'reject' });
	const bypass = map(filter(cfg.devices, (d) => d.mode == 'bypass'), (d) => d.ip);
	if (length(bypass))
		push(route_rules, { source_ip_cidr: bypass, outbound: 'direct' });

	let dns_rules = [];
	for (let r in cfg.rules) {
		let target = null;
		if (r.action == 'proxy') {
			target = resolve_target(r.target, known);
			if (!target) {
				push(errors, `rule ${r.name}: target ${r.target ?? 'auto'} is not available`);
				continue;
			}
		}
		else if (r.action == 'vpn') {
			if (!r.interface) {
				push(errors, `rule ${r.name}: no interface`);
				continue;
			}
			target = 'vpn-' + r.interface;
		}
		else if (r.action == 'direct')
			target = 'direct';

		let sets = [], ipsets = [], suffixes = [ ...(r.domains ?? []) ], cidrs = [ ...(r.subnets ?? []) ];
		for (let svc in r.services ?? [])
			push(sets, add_rule_set('svc-' + svc, ITDOG + svc + '.srs'));
		let categories = [ ...(r.categories ?? []) ];
		for (let p in r.presets ?? []) {
			push(categories, ...(PRESETS[p]?.categories ?? []));
			push(suffixes, ...(PRESETS[p]?.domain_suffix ?? []));
		}
		// geoip sets hold only addresses, so they stay out of the DNS rules.
		for (let cat in categories)
			push(substr(cat, 0, 6) == 'geoip:' ? ipsets : sets, add_rule_set(replace(cat, ':', '-'), category_url(cat)));
		for (let i, url in r.remote_lists ?? [])
			push(sets, add_rule_set(`list-${r.id}-${i}`, url));
		push(suffixes, ...(r.inline_domains ?? []));
		push(cidrs, ...(r.inline_subnets ?? []));

		const act = r.action == 'block' ? { action: 'reject' } : { outbound: target };
		const matchers = filter([
			length(sets) ? { rule_set: sets } : null,
			length(ipsets) ? { rule_set: ipsets, by_ip: true } : null,
			length(suffixes) ? { domain_suffix: suffixes } : null,
			length(cidrs) ? { ip_cidr: cidrs } : null,
		], (m) => m != null);
		for (let m in matchers) {
			let rule = { ...m, ...act };
			delete rule.by_ip;
			push(route_rules, rule);
		}

		const dns_matchers = filter(matchers, (m) => !m.ip_cidr && !m.by_ip);
		for (let m in dns_matchers) {
			if (r.action == 'block')
				push(dns_rules, { ...m, action: 'reject' });
			else if (r.action == 'direct')
				push(dns_rules, { ...m, server: 'dns-direct' });
			else if (!global)
				push(dns_rules, { ...m, query_type: ['A', 'AAAA'], server: 'dns-fakeip' });
		}
	}

	const tunnel = map(filter(cfg.devices, (d) => d.mode == 'tunnel'), (d) => d.ip);
	if (length(tunnel) && known.main)
		push(route_rules, { source_ip_cidr: tunnel, outbound: 'main' });
	if (cfg.lan_proxy.enabled && known.main)
		push(route_rules, { inbound: ['lan-in'], outbound: 'main' });

	let final = 'direct';
	if (global) {
		if (known.main)
			final = 'main';
		else
			push(errors, 'global mode needs at least one server');
	}

	let servers = [
		{ type: 'udp', tag: 'dns-direct', server: cfg.dns.direct },
		{ type: 'udp', tag: 'dns-bootstrap', server: cfg.dns.bootstrap },
		dns_remote(cfg, global && known.main),
	];
	// Kept in global mode too: clients still hold FakeIP answers from before a mode switch,
	// and only this server can map them back to domains.
	let fake = { type: 'fakeip', tag: 'dns-fakeip', inet4_range: FAKEIP_V4 };
	if (cfg.ipv6)
		fake.inet6_range = FAKEIP_V6;
	push(servers, fake);

	let inbounds = [
		{ type: 'tproxy', tag: 'tproxy-in', listen: '::', listen_port: TPROXY_PORT },
		{ type: 'direct', tag: 'dns-in', listen: DNS_LISTEN, listen_port: 53 },
		{ type: 'mixed', tag: 'svc-in', listen: '127.0.0.1', listen_port: SVC_PORT },
	];
	if (cfg.lan_proxy.enabled)
		push(inbounds, { type: 'mixed', tag: 'lan-in', listen: '::', listen_port: cfg.lan_proxy.port });

	let config = {
		log: { level: cfg.log_level, timestamp: false },
		dns: { servers, rules: dns_rules, final: 'dns-remote', strategy: cfg.ipv6 ? 'prefer_ipv4' : 'ipv4_only' },
		inbounds,
		outbounds,
		route: {
			rules: route_rules,
			rule_set: rule_sets,
			final,
			auto_detect_interface: true,
			default_mark: ROUTING_MARK,
			default_domain_resolver: { server: 'dns-direct' },
		},
		experimental: {
			cache_file: { enabled: true, path: cfg.cache_path, store_fakeip: true },
			clash_api: { external_controller: '127.0.0.1:' + cfg.clash.port, secret: cfg.clash.secret },
		},
	};
	if (length(endpoints))
		config.endpoints = endpoints;
	return { config, errors };
};
