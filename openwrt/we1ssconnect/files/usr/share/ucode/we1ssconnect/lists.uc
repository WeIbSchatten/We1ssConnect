// Every remote list is downloaded here, never by sing-box: a rule-set it cannot fetch at start is
// fatal for it, and GitHub is often unreachable before the tunnel is up.

import { readfile, writefile, popen } from 'fs';
import { mkdir_p } from 'we1ssconnect.util';

const ITDOG = 'https://github.com/itdoginfo/allow-domains/releases/latest/download/';
const ITDOG_SUBNETS = 'https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Subnets/IPv4/';

// The same categories as the apps' presets, from the same source as the user's geosite:/geoip:.
export const PRESETS = {
	ru: { categories: ['geosite:category-ru', 'geoip:ru'], domain_suffix: ['ru', 'su', 'xn--p1ai'] },
	ads: { categories: ['geosite:category-ads-all'] },
};

export function service_url(svc) {
	return ITDOG + svc + '.srs';
};

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

export function cache_file(url, dir) {
	return dir + '/' + cache_name(url);
};

// Tries each route in turn (null: direct, else a proxy URL for curl -x) and keeps the copy in dir.
// The cache is rewritten only when the list changed, to spare the router's flash.
export function download(url, dir, routes, max_time) {
	mkdir_p(dir);
	const file = cache_file(url, dir), tmp = '/tmp/we1ss-dl-' + cache_name(url);
	const src = replace(url, "'", '');
	for (let via in routes) {
		const proxy = via ? `-x '${via}' ` : '';
		const p = popen(`curl -fsSL --connect-timeout 8 --max-time ${max_time ?? 60} ${proxy}-o '${tmp}' '${src}' 2>&1`);
		p.read('all');
		if (p.close() != 0)
			continue;
		const fresh = readfile(tmp);
		const changed = fresh != readfile(file);
		system(changed ? `mv '${tmp}' '${file}'` : `rm -f '${tmp}'`);
		return { content: fresh, changed };
	}
	system(`rm -f '${tmp}'`);
	return { content: readfile(file), changed: false };
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
			// decompile writes a one-element list as a bare string
			for (let rule in json(readfile(dir + '/out.json')).rules ?? [])
				push(cidrs, ...(type(rule.ip_cidr) == 'string' ? [rule.ip_cidr] : (rule.ip_cidr ?? [])));
		}
		catch (e) {}
	}
	system(`rm -rf ${dir}`);
	return cidrs;
};

const ITDOG_RAW = 'https://raw.githubusercontent.com/itdoginfo/allow-domains/main/';
const ITDOG_TEXT = {
	russia_inside: 'Russia/inside-raw.lst', russia_outside: 'Russia/outside-raw.lst', ukraine_inside: 'Ukraine/inside-raw.lst',
	anime: 'Categories/anime.lst', block: 'Categories/block.lst', geoblock: 'Categories/geoblock.lst',
	hodca: 'Categories/hodca.lst', news: 'Categories/news.lst', porn: 'Categories/porn.lst',
};

// The text lists itdoginfo compiles each release .srs from: GitHub release downloads fail
// (504) for days while raw.githubusercontent.com still answers.
export function service_fallback(url) {
	if (substr(url, 0, length(ITDOG)) != ITDOG)
		return null;
	const svc = replace(substr(url, length(ITDOG)), /\.srs$/, '');
	return {
		domains: ITDOG_RAW + (ITDOG_TEXT[svc] ?? `Services/${svc}.lst`),
		subnets: index(SERVICE_SUBNETS, svc) >= 0 ? ITDOG_SUBNETS + svc + '.lst' : null,
	};
};

// Compiles domain and subnet text lists into a binary rule-set at out; false when both are empty.
export function compile_plain(domains_text, subnets_text, out) {
	const d = parse_plain(domains_text), s = parse_plain(subnets_text);
	let rules = [];
	if (length(d.domains))
		push(rules, { domain_suffix: d.domains });
	if (length(s.cidrs))
		push(rules, { ip_cidr: s.cidrs });
	if (!length(rules))
		return false;
	const src = out + '.json';
	writefile(src, sprintf('%J', { version: 2, rules }));
	const ok = system(`sing-box rule-set compile '${src}' -o '${out}.new' >/dev/null 2>&1 && mv '${out}.new' '${out}'`) == 0;
	system(`rm -f '${src}' '${out}.new'`);
	return ok;
};

// download() with the text-list fallback for itdoginfo services that have no cached copy yet.
export function fetch_list(url, dir, routes, max_time) {
	const d = download(url, dir, routes, max_time);
	const fb = service_fallback(url);
	if (d.content != null || !fb)
		return d;
	const text = download(fb.domains, dir, routes, max_time).content;
	const subnets = fb.subnets ? download(fb.subnets, dir, routes, max_time).content : null;
	const file = cache_file(url, dir);
	if (text == null || !compile_plain(text, subnets, file))
		return d;
	return { content: readfile(file), changed: true };
};

// Every rule-set a rule uses, in sing-box rule order: [tag, url, by_ip, category or null].
export function rule_sets_of(r) {
	let out = [];
	for (let svc in r.services ?? [])
		push(out, ['svc-' + svc, service_url(svc), false, null]);
	let cats = map(r.categories ?? [], (c) => [c, true]);
	for (let p in r.presets ?? [])
		push(cats, ...map(PRESETS[p]?.categories ?? [], (c) => [c, false]));
	for (let c in cats)
		push(out, [replace(c[0], ':', '-'), category_url(c[0]), substr(c[0], 0, 6) == 'geoip:', c[1] ? c[0] : null]);
	for (let i, url in filter(r.remote_lists ?? [], is_rule_set))
		push(out, [`list-${r.id}-${i}`, url, false, null]);
	return out;
};

// Fills inline_domains/inline_subnets of each rule and cfg.rule_set_files (url → downloaded file),
// drops categories that are not published, and returns the subnets nft must intercept.
export function resolve(cfg, fetch, cidrs_of, path_of) {
	let route_subnets = [], missing = [];
	cfg.rule_set_files = {};
	for (let r in cfg.rules) {
		const tunnel = r.action == 'proxy' || r.action == 'vpn';
		let found = {};
		for (let rs in rule_sets_of(r)) {
			const content = fetch(rs[1]);
			if (content == null) {
				push(missing, rs[1]);
				continue;
			}
			cfg.rule_set_files[rs[1]] = (path_of ?? ((u) => u))(rs[1]);
			if (rs[3])
				found[rs[3]] = true;
			if (tunnel && rs[2])
				push(route_subnets, ...(cidrs_of ?? srs_cidrs)(content));
		}
		r.categories = filter(r.categories ?? [], (c) => found[c]);
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
