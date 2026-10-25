import { test, eq, ok, done } from 't';
import { writefile, mkdir } from 'fs';
import * as store from 'we1ssconnect.store';
import * as sub from 'we1ssconnect.subscription';

const dir = '/tmp/we1ss-test-' + store.new_id();
mkdir(dir);

function fresh() {
	return { servers: [], subscriptions: {} };
}

test('refresh keeps ids by name, drops vanished servers, adds new ones', () => {
	let data = fresh();
	store.add_links(data, 'trojan://pw@m:1#manual');
	const first = store.replace_source(data, 'sub1', [
		{ ok: true, name: 'A', outbound: { type: 'trojan' } },
		{ ok: true, name: 'B', outbound: { type: 'trojan' } },
	]);
	const second = store.replace_source(data, 'sub1', [
		{ ok: true, name: 'B', outbound: { type: 'vless' } },
		{ ok: false, name: 'C', reason: 'xhttp transport is not supported by sing-box' },
	]);
	eq(second[0].id, first[1].id, 'B keeps its id');
	ok(second[1].id != first[0].id, 'C does not inherit the vanished A');
	eq(second[0].outbound.type, 'vless', 'B takes the new outbound');
	eq(map(data.servers, (s) => s.name), ['manual', 'B', 'C']);
	eq(map(store.usable(data), (s) => s.name), ['manual', 'B']);
	eq(data.servers[2].reason, 'xhttp transport is not supported by sing-box');
});

test('duplicate names map to distinct ids', () => {
	let data = fresh();
	const a = store.replace_source(data, 's', [{ ok: true, name: 'X' }, { ok: true, name: 'X' }]);
	const b = store.replace_source(data, 's', [{ ok: true, name: 'X' }, { ok: true, name: 'X' }]);
	eq(map(b, (s) => s.id), map(a, (s) => s.id));
	ok(a[0].id != a[1].id);
});

test('save and load round-trip through the state dir', () => {
	let data = fresh();
	store.add_links(data, 'trojan://pw@m:1#one');
	store.save(data);
	eq(map(store.load().servers, (s) => s.name), ['one']);
});

test('remove and remove_source', () => {
	let data = fresh();
	const added = store.add_links(data, 'trojan://pw@m:1#a\ntrojan://pw@m:2#b');
	store.replace_source(data, 'sub', [{ ok: true, name: 'c' }]);
	data.subscriptions.sub = { updated: 1 };
	eq(store.remove(data, added[0].id), true);
	eq(store.remove(data, 'nope'), false);
	store.remove_source(data, 'sub');
	eq(map(data.servers, (s) => s.name), ['b']);
	eq(data.subscriptions, {});
});

test('subscription headers', () => {
	eq(sub.parse_userinfo('upload=10; download=20; total=100; expire=1700000000'), { upload: 10, download: 20, total: 100, expire: 1700000000 });
	eq(sub.parse_userinfo('foo=1'), null);
	eq(sub.parse_title('base64:' + b64enc('Моя подписка')), 'Моя подписка');
	eq(sub.parse_title(' We1ss '), 'We1ss');
	eq(sub.parse_headers('HTTP/1.1 302 Found\r\nLocation: /x\r\n\r\nHTTP/1.1 200 OK\r\nProfile-Title: T\r\n\r\n'), { ':status': 200, 'profile-title': 'T' });
});

test('update downloads with curl and replaces the source', () => {
	writefile(dir + '/body.txt', b64enc('trojan://pw@a:1#one\nvless://u@b:2?type=xhttp#two\n'));
	let data = fresh();
	eq(sub.update(data, 'sub9', 'file://' + dir + '/body.txt', 'We1ssConnect/test'), { added: 1, skipped: 1 });
	eq(map(data.servers, (s) => [s.source, s.name, s.ok]), [['sub9', 'one', true], ['sub9', 'two', false]]);
	ok(data.subscriptions.sub9.updated > 0);
	eq(sub.update(data, 'sub9', 'file://' + dir + '/missing.txt', 'We1ssConnect/test').error != null, true, 'a failed download reports an error');
	eq(length(data.servers), 2, 'and keeps the old servers');
});

done();
