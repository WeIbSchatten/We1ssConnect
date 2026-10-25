// Small helpers shared by the We1ssConnect modules.

import { mkdir, stat } from 'fs';

// /var/run is missing until procd creates it, and fs.mkdir does not create parents.
export function mkdir_p(path) {
	let cur = '';
	for (let part in split(path, '/')) {
		if (part == '')
			continue;
		cur += '/' + part;
		if (!stat(cur))
			mkdir(cur, 0755);
	}
	return stat(path)?.type == 'directory';
};

export function urldecode(s) {
	if (s == null)
		return null;
	return replace(replace(s, /\+/g, ' '), /%([0-9A-Fa-f]{2})/g, (m, h) => chr(hex(h)));
};

// Path and fragment parts must keep "+" (it is not a space there).
export function pctdecode(s) {
	if (s == null)
		return null;
	return replace(s, /%([0-9A-Fa-f]{2})/g, (m, h) => chr(hex(h)));
};

// Accepts standard and URL-safe base64, with or without padding; null when it is not base64.
export function b64decode(s) {
	if (type(s) != 'string')
		return null;
	s = replace(s, /\s+/g, '');
	if (!length(s) || !match(s, /^[A-Za-z0-9+\/_-]+=*$/))
		return null;
	s = replace(replace(replace(s, /=+$/, ''), /-/g, '+'), /_/g, '/');
	while (length(s) % 4)
		s += '=';
	return b64dec(s);
};

export function parse_query(q) {
	let out = {};
	if (!q)
		return out;
	for (let part in split(q, '&')) {
		if (part == '')
			continue;
		const eqpos = index(part, '=');
		const k = urldecode(eqpos < 0 ? part : substr(part, 0, eqpos));
		out[k] = eqpos < 0 ? '' : urldecode(substr(part, eqpos + 1));
	}
	return out;
};

// scheme://userinfo@host:port/path?query#fragment; host without IPv6 brackets.
export function parse_url(s) {
	const m = match(s, /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^#]*)(#(.*))?$/);
	if (!m)
		return null;
	let rest = m[2], fragment = m[4];
	let query = null, path = '';
	let qpos = index(rest, '?');
	if (qpos >= 0) {
		query = substr(rest, qpos + 1);
		rest = substr(rest, 0, qpos);
	}
	// Userinfo first: standard base64 credentials may contain "/".
	let userinfo = null;
	let at = rindex(rest, '@');
	if (at >= 0) {
		userinfo = substr(rest, 0, at);
		rest = substr(rest, at + 1);
	}
	let spos = index(rest, '/');
	if (spos >= 0) {
		path = substr(rest, spos);
		rest = substr(rest, 0, spos);
	}
	let host = rest, port = null;
	let hm = match(rest, /^\[([^\]]+)\](:(\d*))?$/) ?? match(rest, /^([^:]*)(:(\d*))?$/);
	if (hm) {
		host = hm[1];
		port = hm[3];
	}
	return {
		scheme: lc(m[1]), userinfo, host, port: (port != null && port != '') ? int(port) : null,
		path, query: parse_query(query), fragment: fragment != null ? pctdecode(fragment) : null,
	};
};

export function csv(s) {
	if (s == null || s == '')
		return [];
	return filter(map(split(s, ','), (x) => trim(x)), (x) => x != '');
};

export function truthy(v) {
	return v === true || v == '1' || lc(`${v}`) == 'true' || lc(`${v}`) == 'yes' || lc(`${v}`) == 'on';
};
