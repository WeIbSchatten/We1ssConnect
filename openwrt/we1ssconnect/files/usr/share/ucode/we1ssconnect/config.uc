// UCI sections of /etc/config/we1ssconnect to the normalized settings singbox.build() takes.

import { truthy } from 'we1ssconnect.util';

export const DEFAULTS = {
	enabled: '0', mode: 'selective', selected: 'auto',
	urltest_url: 'https://www.gstatic.com/generate_204', urltest_interval: '3m', urltest_tolerance: '50',
	dns_type: 'doh', dns_server: '1.1.1.1', bootstrap_dns: '77.88.8.8', direct_dns: '77.88.8.8',
	source_iface: ['br-lan'], ipv6: '0', lan_proxy: '0', lan_proxy_port: '2080',
	block_quic: '0', exclude_ntp: '1', intercept_dns: '1', fragment: '0', force_chrome_fp: '1',
	list_update_interval: '1d', lists_via_tunnel: '0', sub_update_interval: '12h',
	manage_dnsmasq: '1', log_level: 'warn', clash_port: '9090',
};

// Category names of the published rule-sets; attributes like google@cn are not among them.
const CATEGORY = /^[a-z0-9][a-z0-9._!-]*$/;

function list(v) {
	if (v == null || v == '')
		return [];
	return type(v) == 'array' ? v : [v];
}

function lines(v) {
	let out = [];
	for (let item in list(v))
		for (let x in split(item, /[[:space:],]+/))
			if (x != '')
				push(out, x);
	return out;
}

// Returns a regexp, true (no filter) or null (bad filter, reported once).
function compile_filter(pattern, errors, owner) {
	if (!pattern)
		return true;
	try {
		return regexp(pattern, 'i');
	}
	catch (e) {
		push(errors, `${owner}: bad filter ${pattern}`);
		return null;
	}
}

// sections: UCI sections in file order, each with ".type" and ".name"; data: the server store.
export function normalize(sections, data, runtime) {
	let main = { ...DEFAULTS }, errors = [];
	for (let s in sections)
		if (s['.type'] == 'settings')
			for (let k in s)
				if (substr(k, 0, 1) != '.')
					main[k] = s[k];

	let groups = [], rules = [], devices = [], subscriptions = [];
	for (let s in sections) {
		const id = s['.name'];
		if (s['.type'] == 'subscription')
			push(subscriptions, { id, name: s.name || id, url: s.url, enabled: s.enabled != '0', filter: s.filter, user_agent: s.user_agent });
		else if (s['.type'] == 'group') {
			const subs = list(s.subscription), explicit = list(s.server);
			const re = compile_filter(s.filter, errors, `group ${s.name || id}`);
			let members = [];
			for (let srv in data.servers) {
				if (!srv.ok)
					continue;
				const wanted = index(explicit, srv.id) >= 0 || index(subs, srv.source) >= 0;
				if (wanted && re && (re === true || match(srv.name, re)))
					push(members, srv.id);
			}
			push(groups, { id, name: s.name || id, servers: members, selected: s.selected });
		}
		else if (s['.type'] == 'rule' && s.enabled != '0') {
			// geosite:/geoip: also work in the domain and subnet fields, as they do in Xray.
			const name = s.name || id;
			let categories = [], domains = [], subnets = [];
			for (let e in [ ...list(s.category), ...lines(s.domain), ...lines(s.subnet) ]) {
				const m = match(lc(e), /^(geosite|geoip):(.*)$/);
				if (m && match(m[2], CATEGORY))
					push(categories, m[1] + ':' + m[2]);
				else if (m)
					push(errors, `rule ${name}: bad category ${e}`);
			}
			for (let e in lines(s.domain))
				if (!match(lc(e), /^geo(site|ip):/))
					push(domains, e);
			for (let e in lines(s.subnet))
				if (!match(lc(e), /^geo(site|ip):/))
					push(subnets, e);
			push(rules, {
				id, name, action: s.action || 'proxy', target: s.target || 'auto', interface: s.interface,
				services: list(s.service), presets: list(s.preset), remote_lists: list(s.remote_list),
				categories: uniq(categories), domains, subnets,
			});
		}
		else if (s['.type'] == 'device' && s.ip && (s.mode == 'tunnel' || s.mode == 'bypass'))
			push(devices, { name: s.name || s.ip, ip: s.ip, mode: s.mode });
	}

	const cfg = {
		enabled: truthy(main.enabled), mode: main.mode == 'global' ? 'global' : 'selective', selected: main.selected || 'auto',
		urltest: { url: main.urltest_url, interval: main.urltest_interval, tolerance: int(main.urltest_tolerance) },
		dns: { type: main.dns_type, server: main.dns_server, bootstrap: main.bootstrap_dns, direct: main.direct_dns },
		ifaces: list(main.source_iface), ipv6: truthy(main.ipv6),
		lan_proxy: { enabled: truthy(main.lan_proxy), port: int(main.lan_proxy_port) },
		block_quic: truthy(main.block_quic), exclude_ntp: truthy(main.exclude_ntp), intercept_dns: truthy(main.intercept_dns),
		fragment: truthy(main.fragment), force_chrome_fp: truthy(main.force_chrome_fp),
		lists: { update_interval: main.list_update_interval, via_tunnel: truthy(main.lists_via_tunnel) },
		sub_update_interval: main.sub_update_interval, manage_dnsmasq: truthy(main.manage_dnsmasq),
		log_level: main.log_level,
		clash: { port: int(main.clash_port), secret: runtime?.secret ?? '' },
		cache_path: runtime?.cache_path ?? '/tmp/we1ssconnect/cache.db',
		groups, rules, devices, subscriptions,
	};
	return { cfg, errors };
};

export function load_sections() {
	const uci = require('uci');
	let c = uci.cursor(), out = [];
	c.load('we1ssconnect');
	c.foreach('we1ssconnect', null, (s) => { push(out, s); });
	return out;
};
