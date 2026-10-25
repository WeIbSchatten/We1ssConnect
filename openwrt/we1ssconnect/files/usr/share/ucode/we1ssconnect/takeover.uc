// Other clients capture the same traffic, DNS and TPROXY port, so they cannot run beside us.
// Ones that are running or start at boot are stopped and lose their autostart; nothing is removed.

import { stat, readfile, writefile } from 'fs';
import { state_dir } from 'we1ssconnect.store';
import { mkdir_p } from 'we1ssconnect.util';

export const RIVALS = ['podkop', 'passwall', 'passwall2', 'openclash', 'nikki', 'https-dns-proxy'];

function record_path() {
	return state_dir() + '/taken_over.json';
}

export function active(name) {
	const script = `/etc/init.d/${name}`;
	if (!stat(script))
		return false;
	return system(`${script} enabled >/dev/null 2>&1`) == 0 || system(`${script} running >/dev/null 2>&1`) == 0;
};

function stop_and_disable(name) {
	system(`/etc/init.d/${name} stop >/dev/null 2>&1`);
	system(`/etc/init.d/${name} disable >/dev/null 2>&1`);
}

export function taken_over() {
	try {
		return json(readfile(record_path()) ?? 'null') ?? { names: [] };
	}
	catch (e) {
		return { names: [] };
	}
};

// Returns the services stopped by this call.
export function take_over() {
	let stopped = [];
	for (let name in RIVALS)
		if (active(name)) {
			stop_and_disable(name);
			push(stopped, name);
		}
	// podkop runs its sing-box through the package's own service; without podkop it is the user's.
	if (stat('/etc/init.d/podkop') && active('sing-box')) {
		stop_and_disable('sing-box');
		push(stopped, 'sing-box');
	}
	if (length(stopped)) {
		const prev = taken_over();
		mkdir_p(state_dir());
		writefile(record_path(), sprintf('%J', { names: uniq([ ...(prev.names ?? []), ...stopped ]), at: time() }));
	}
	return stopped;
};
