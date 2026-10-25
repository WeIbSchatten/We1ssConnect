import { test, eq, ok, done } from 't';
import { writefile, readfile, unlink, chmod, popen } from 'fs';
import { take_over, taken_over } from 'we1ssconnect.takeover';

function sh(cmd) {
	const p = popen(cmd + ' 2>&1');
	const out = p.read('all');
	return [p.close(), trim(out ?? '')];
}

// A real rc.common script, so enable/enabled/disable behave as on a router.
function fake_service(name) {
	writefile(`/etc/init.d/${name}`, `#!/bin/sh /etc/rc.common\nSTART=99\nstart() { :; }\nstop() { echo stop >> /tmp/${name}.calls; }\n`);
	chmod(`/etc/init.d/${name}`, 0755);
	unlink(`/tmp/${name}.calls`);
}

fake_service('podkop');
fake_service('passwall');
sh('/etc/init.d/podkop enable');
sh('/etc/init.d/sing-box enable');

test('enabled rivals are stopped and lose their autostart; podkop takes its sing-box along', () => {
	eq(take_over(), ['podkop', 'sing-box']);
	eq(trim(readfile('/tmp/podkop.calls') ?? ''), 'stop', 'podkop was stopped');
	eq(sh('/etc/init.d/podkop enabled')[0] != 0, true, 'podkop no longer starts at boot');
	eq(sh('/etc/init.d/sing-box enabled')[0] != 0, true, 'nor its sing-box service');
});

test('an installed but disabled client is left alone', () => {
	eq(readfile('/tmp/passwall.calls'), null);
	eq(sh('/etc/init.d/passwall enabled')[0] != 0, true);
});

test('a second run has nothing to do, and the record keeps what was stopped', () => {
	eq(take_over(), []);
	eq(taken_over().names, ['podkop', 'sing-box']);
	ok(taken_over().at > 0);
});

test('without podkop the sing-box service is someone else\'s and stays', () => {
	unlink('/etc/init.d/podkop');
	sh('/etc/init.d/sing-box enable');
	eq(take_over(), []);
	eq(sh('/etc/init.d/sing-box enabled')[0], 0);
});

done();
