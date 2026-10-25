// Points dnsmasq at the sing-box DNS inbound and puts the user's settings back on stop.

import { readfile, writefile, unlink } from 'fs';
import { DNS_LISTEN } from 'we1ssconnect.singbox';
import { state_dir } from 'we1ssconnect.store';

const KEYS = ['server', 'noresolv', 'resolvfile'];

function backup_path() {
	return state_dir() + '/dnsmasq.backup.json';
}

function first_dnsmasq(c) {
	let name = null;
	c.foreach('dhcp', 'dnsmasq', (s) => {
		name ??= s['.name'];
	});
	return name;
}

function restart() {
	system('/etc/init.d/dnsmasq restart >/dev/null 2>&1');
}

export function apply(c) {
	c.load('dhcp');
	const name = first_dnsmasq(c);
	if (!name)
		return 'no dnsmasq section in /etc/config/dhcp';
	// Keep the first backup: a second start must not save our own settings as the user's.
	if (readfile(backup_path()) == null) {
		let saved = { section: name };
		for (let k in KEYS)
			saved[k] = c.get('dhcp', name, k);
		writefile(backup_path(), sprintf('%J', saved));
	}
	c.set('dhcp', name, 'server', [DNS_LISTEN]);
	c.set('dhcp', name, 'noresolv', '1');
	c.delete('dhcp', name, 'resolvfile');
	c.commit('dhcp');
	restart();
	return null;
};

export function restore(c) {
	const raw = readfile(backup_path());
	if (raw == null)
		return false;
	const saved = json(raw);
	c.load('dhcp');
	for (let k in KEYS) {
		if (saved[k] == null)
			c.delete('dhcp', saved.section, k);
		else
			c.set('dhcp', saved.section, k, saved[k]);
	}
	c.commit('dhcp');
	unlink(backup_path());
	restart();
	return true;
};

export function is_applied() {
	return readfile(backup_path()) != null;
};
