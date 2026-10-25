// Servers live in a JSON file next to the UCI config: subscriptions bring hundreds of them,
// which UCI and LuCI forms handle badly. Ids stay stable across subscription refreshes.

import { readfile, writefile, rename } from 'fs';
import { mkdir_p } from 'we1ssconnect.util';
import { parse_all } from 'we1ssconnect.links';

export function state_dir() {
	return getenv('WE1SS_STATE_DIR') || '/etc/we1ssconnect';
};

function path() {
	return state_dir() + '/servers.json';
}

export function new_id() {
	const bytes = readfile('/dev/urandom', 4);
	let id = '';
	for (let i = 0; i < 4; i++)
		id += sprintf('%02x', ord(bytes, i));
	return id;
};

export function load() {
	let data = null;
	try {
		data = json(readfile(path()) ?? 'null');
	}
	catch (e) {
		data = null;
	}
	if (type(data) != 'object')
		data = {};
	data.servers ??= [];
	data.subscriptions ??= {};
	return data;
};

export function save(data) {
	mkdir_p(state_dir());
	const tmp = path() + '.tmp';
	writefile(tmp, sprintf('%.J\n', data));
	rename(tmp, path());
};

export function find(data, id) {
	for (let s in data.servers)
		if (s.id == id)
			return s;
	return null;
};

function entry(r, source, id) {
	let s = { id, name: r.name, source, ok: r.ok };
	if (r.ok) {
		s.outbound = r.outbound;
		if (r.endpoint)
			s.endpoint = true;
	}
	else
		s.reason = r.reason;
	return s;
}

// Replaces every server of one source; a server keeps its id when a server of the same name
// was there before, so the pinned server and groups survive a refresh.
export function replace_source(data, source, results) {
	let previous = filter(data.servers, (s) => s.source == source);
	let taken = {}, fresh = [];
	for (let r in results) {
		let id = null;
		for (let p in previous)
			if (p.name == r.name && !taken[p.id]) {
				id = p.id;
				break;
			}
		id ??= new_id();
		taken[id] = true;
		push(fresh, entry(r, source, id));
	}
	data.servers = [ ...filter(data.servers, (s) => s.source != source), ...fresh ];
	return fresh;
};

export function add_links(data, text) {
	let added = [];
	for (let r in parse_all(text))
		push(added, entry(r, 'manual', new_id()));
	data.servers = [ ...data.servers, ...added ];
	return added;
};

export function remove(data, id) {
	const before = length(data.servers);
	data.servers = filter(data.servers, (s) => s.id != id);
	return length(data.servers) < before;
};

export function remove_source(data, source) {
	data.servers = filter(data.servers, (s) => s.source != source);
	delete data.subscriptions[source];
};

// Servers sing-box can run, in list order.
export function usable(data) {
	return filter(data.servers, (s) => s.ok);
};
