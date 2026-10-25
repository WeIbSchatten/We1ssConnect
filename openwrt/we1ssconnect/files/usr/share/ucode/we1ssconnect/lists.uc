// Remote lists: sing-box fetches .srs/.json rule-sets itself; plain-text domain/CIDR lists and
// the service subnet lists (needed in nft, which cannot read rule-sets) are fetched here.

import { readfile, writefile, popen } from 'fs';
import { mkdir_p } from 'we1ssconnect.util';

const ITDOG_SUBNETS = 'https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Subnets/IPv4/';

// Services whose apps also connect by IP, so their subnets must be intercepted in nft.
export const SERVICE_SUBNETS = ['discord', 'telegram', 'meta', 'twitter', 'cloudflare', 'cloudfront', 'digitalocean', 'hetzner', 'ovh', 'roblox', 'google_meet'];

export function is_rule_set(url) {
	return match(url, /\.(srs|json)(\?.*)?$/) != null;
};

const CIDR4 = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/;
const CIDR6 = /^[0-9A-Fa-f:]*:[0-9A-Fa-f:.]*(\/[0-9]{1,3})?$/;

export function parse_plain(text) {
	let domains = [], cidrs = [];
	for (let line in split(text ?? '', /\r?\n/)) {
		line = trim(replace(line, /#.*$/, ''));
		if (line == '')
			continue;
		if (match(line, CIDR4))
			push(cidrs, index(line, '/') < 0 ? line + '/32' : line);
		else if (match(line, CIDR6))
			push(cidrs, index(line, '/') < 0 ? line + '/128' : line);
		else {
			line = lc(replace(replace(line, /^(domain|full|domain-suffix|DOMAIN-SUFFIX),/, ''), /^(domain:|full:|\*\.|\.)/, ''));
			if (match(line, /^[a-z0-9_.-]+$/) && index(line, '.') >= 0)
				push(domains, line);
		}
	}
	return { domains, cidrs };
};

function cache_name(url) {
	return replace(url, /[^A-Za-z0-9._-]/g, '_');
}

// Downloads to a cache; a failed download falls back to the last good copy.
export function fetch_cached(url, dir, via_proxy) {
	mkdir_p(dir);
	const file = dir + '/' + cache_name(url);
	const proxy = via_proxy ? `--socks5-hostname ${via_proxy} ` : '';
	const p = popen(`curl -fsSL --max-time 30 ${proxy}-o '${file}.new' '${replace(url, "'", '')}' 2>&1 && mv '${file}.new' '${file}'`);
	p.read('all');
	p.close();
	return readfile(file);
};

// The same data as runetfreedom's geosite.dat/geoip.dat, one .srs per category.
export const CATEGORY_BASE = 'https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/sing-box/';

export function category_url(category) {
	const m = match(category, /^(geosite|geoip):(.+)$/);
	return `${CATEGORY_BASE}rule-set-${m[1]}/${m[1]}-${m[2]}.srs`;
};

// CIDRs of a compiled rule-set, read back with this router's sing-box.
export function srs_cidrs(content) {
	const dir = '/tmp/we1ss-srs-' + time();
	mkdir_p(dir);
	writefile(dir + '/in.srs', content ?? '');
	let cidrs = [];
	if (system(`sing-box rule-set decompile ${dir}/in.srs -o ${dir}/out.json >/dev/null 2>&1`) == 0) {
		try {
			for (let rule in json(readfile(dir + '/out.json')).rules ?? [])
				push(cidrs, ...(rule.ip_cidr ?? []));
		}
		catch (e) {}
	}
	system(`rm -rf ${dir}`);
	return cidrs;
};

// Fills inline_domains/inline_subnets of each rule, drops categories that are not published,
// and returns the subnets nft must intercept.
export function resolve(cfg, fetch, cidrs_of) {
	let route_subnets = [], missing = [];
	for (let r in cfg.rules) {
		let found = [];
		for (let cat in r.categories ?? []) {
			const content = fetch(category_url(cat));
			if (content == null) {
				push(missing, category_url(cat));
				continue;
			}
			push(found, cat);
			if ((r.action == 'proxy' || r.action == 'vpn') && substr(cat, 0, 6) == 'geoip:')
				push(route_subnets, ...(cidrs_of ?? srs_cidrs)(content));
		}
		r.categories = found;
		const plain = filter(r.remote_lists, (u) => !is_rule_set(u));
		r.remote_lists = filter(r.remote_lists, (u) => is_rule_set(u));
		r.inline_domains = [];
		r.inline_subnets = [];
		for (let url in plain) {
			const text = fetch(url);
			if (text == null) {
				push(missing, url);
				continue;
			}
			const parsed = parse_plain(text);
			push(r.inline_domains, ...parsed.domains);
			push(r.inline_subnets, ...parsed.cidrs);
		}
		if (r.action != 'proxy' && r.action != 'vpn')
			continue;
		push(route_subnets, ...r.subnets, ...r.inline_subnets);
		for (let svc in r.services)
			if (index(SERVICE_SUBNETS, svc) >= 0) {
				const text = fetch(ITDOG_SUBNETS + svc + '.lst');
				if (text == null)
					push(missing, ITDOG_SUBNETS + svc + '.lst');
				else
					push(route_subnets, ...parse_plain(text).cidrs);
			}
	}
	return { route_subnets: uniq(route_subnets), missing };
};
