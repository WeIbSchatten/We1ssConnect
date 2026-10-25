// Client of the sing-box Clash API on localhost: delays, the pinned server, connections.

import { popen } from 'fs';

function q(s) {
	return "'" + replace(`${s}`, "'", "'\\''") + "'";
}

// Returns { status, body } or { error }.
export function call(api, method, path, body) {
	let cmd = sprintf('curl -s -m 12 -o - -w "\\n%%{http_code}" -X %s -H %s', method, q('Authorization: Bearer ' + api.secret));
	if (body != null)
		cmd += sprintf(' -H "Content-Type: application/json" -d %s', q(sprintf('%J', body)));
	cmd += ' ' + q(`http://127.0.0.1:${api.port}${path}`) + ' 2>/dev/null';
	const p = popen(cmd);
	const out = p.read('all');
	p.close();
	const nl = rindex(out, '\n');
	const status = int(substr(out, nl + 1));
	if (!status)
		return { error: 'sing-box is not running' };
	let parsed = null;
	try {
		parsed = json(substr(out, 0, nl));
	}
	catch (e) {
		parsed = null;
	}
	return { status, body: parsed };
};

export function proxies(api) {
	const r = call(api, 'GET', '/proxies');
	return r.error ? r : (r.body?.proxies ?? {});
};

// Delay of every member of a urltest/selector group, measured now.
export function group_delay(api, group, url, timeout_ms) {
	const r = call(api, 'GET', `/group/${group}/delay?url=${url}&timeout=${timeout_ms}`);
	return r.error ? r : (r.body ?? {});
};

export function delay(api, tag, url, timeout_ms) {
	const r = call(api, 'GET', `/proxies/${tag}/delay?url=${url}&timeout=${timeout_ms}`);
	if (r.error)
		return r;
	return r.status == 200 ? { delay: r.body?.delay } : { delay: -1 };
};

export function select(api, selector, tag) {
	const r = call(api, 'PUT', `/proxies/${selector}`, { name: tag });
	return r.error ? r : { ok: r.status == 204 || r.status == 200 };
};

export function connections(api) {
	const r = call(api, 'GET', '/connections');
	return r.error ? r : r.body;
};
