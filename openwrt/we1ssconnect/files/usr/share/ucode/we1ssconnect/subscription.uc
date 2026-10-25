// Subscription download and the panel headers (profile-title, subscription-userinfo).

import { popen, readfile, unlink, mkdir, rmdir } from 'fs';
import { b64decode } from 'we1ssconnect.util';
import { parse_all } from 'we1ssconnect.links';
import { replace_source, new_id } from 'we1ssconnect.store';

// "upload=1; download=2; total=3; expire=4"; null without any of the known keys.
export function parse_userinfo(header) {
	if (!header)
		return null;
	let v = {};
	for (let part in split(header, ';')) {
		const kv = map(split(part, '='), (x) => trim(x));
		if (length(kv) == 2 && match(kv[1], /^\d+$/))
			v[lc(kv[0])] = int(kv[1]);
	}
	if (v.total == null && v.download == null && v.expire == null)
		return null;
	return { upload: v.upload ?? 0, download: v.download ?? 0, total: v.total ?? 0, expire: v.expire ?? 0 };
};

// Plain text or "base64:<text>".
export function parse_title(header) {
	if (!header)
		return null;
	const value = trim(header);
	if (lc(substr(value, 0, 7)) != 'base64:')
		return value || null;
	return b64decode(substr(value, 7)) || null;
};

function shell_quote(s) {
	return "'" + replace(s, "'", "'\\''") + "'";
}

// Last response's headers, lower-cased; curl -D writes one block per redirect.
export function parse_headers(raw) {
	let h = {};
	for (let line in split(raw ?? '', /\r?\n/)) {
		if (match(line, /^HTTP\//)) {
			h = { ':status': int(split(line, ' ')[1]) };
			continue;
		}
		const i = index(line, ':');
		if (i > 0)
			h[lc(trim(substr(line, 0, i)))] = trim(substr(line, i + 1));
	}
	return h;
};

export function fetch(url, user_agent) {
	const dir = '/tmp/we1ss-sub-' + new_id();
	mkdir(dir, 0700);
	const cmd = sprintf('curl -sSL --max-time 30 --retry 1 -A %s -D %s -o %s %s 2>&1',
		shell_quote(user_agent), shell_quote(dir + '/h'), shell_quote(dir + '/b'), shell_quote(url));
	const p = popen(cmd);
	const out = p.read('all');
	const code = p.close();
	const headers = parse_headers(readfile(dir + '/h'));
	const body = readfile(dir + '/b');
	unlink(dir + '/h');
	unlink(dir + '/b');
	rmdir(dir);
	if (code != 0)
		return { error: trim(out) || `curl exit ${code}` };
	const status = headers[':status'] ?? 200;
	if (status < 200 || status >= 300)
		return { error: `HTTP ${status}` };
	return { body, headers };
};

// Refreshes one subscription in the store; returns { added, skipped } or { error }.
export function update(data, id, url, user_agent) {
	const res = fetch(url, user_agent);
	let info = data.subscriptions[id] ?? {};
	info.updated = time();
	if (res.error) {
		info.error = res.error;
		data.subscriptions[id] = info;
		return { error: res.error };
	}
	const results = parse_all(res.body);
	if (!length(results)) {
		info.error = 'no servers in the subscription';
		data.subscriptions[id] = info;
		return { error: info.error };
	}
	const fresh = replace_source(data, id, results);
	delete info.error;
	info.title = parse_title(res.headers['profile-title']);
	info.userinfo = parse_userinfo(res.headers['subscription-userinfo']);
	info.page = res.headers['profile-web-page-url'];
	data.subscriptions[id] = info;
	return { added: length(filter(fresh, (s) => s.ok)), skipped: length(filter(fresh, (s) => !s.ok)) };
};
