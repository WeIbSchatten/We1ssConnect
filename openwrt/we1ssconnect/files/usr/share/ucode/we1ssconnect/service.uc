// Every action of the router client, shared by the `we1ssconnect` CLI and the rpcd object.

import { readfile, writefile, mkdir, popen, unlink, stat } from 'fs';
import { cursor } from 'uci';
import * as store from 'we1ssconnect.store';
import * as sub from 'we1ssconnect.subscription';
import * as config from 'we1ssconnect.config';
import * as singbox from 'we1ssconnect.singbox';
import * as lists from 'we1ssconnect.lists';
import * as nft from 'we1ssconnect.nft';
import * as dnsmasq from 'we1ssconnect.dnsmasq';
import * as clash from 'we1ssconnect.clash';

export const VERSION = '0.0.0-dev';
export const REPO = 'WeIbSchatten/We1ssConnect';
export const RUN_DIR = getenv('WE1SS_RUN_DIR') || '/var/run/we1ssconnect';
const TMP_DIR = '/tmp/we1ssconnect';
const SVC_PROXY = 'socks5h://127.0.0.1:' + singbox.SVC_PORT;

function q(s) {
	return "'" + replace(`${s}`, "'", "'\\''") + "'";
}

function sh(cmd) {
	const p = popen(cmd + ' 2>&1');
	const out = p.read('all');
	return { code: p.close(), out: trim(out ?? '') };
}

function user_agent() {
	return `We1ssConnect/${VERSION} (OpenWrt)`;
}

function secret() {
	let s = trim(readfile(RUN_DIR + '/secret') ?? '');
	if (s == '') {
		s = store.new_id() + store.new_id() + store.new_id();
		mkdir(RUN_DIR);
		writefile(RUN_DIR + '/secret', s);
	}
	return s;
}

function load_cfg() {
	const data = store.load();
	const r = config.normalize(config.load_sections(), data, { secret: secret(), cache_path: TMP_DIR + '/cache.db' });
	return { data, cfg: r.cfg, errors: r.errors };
}

function api(cfg) {
	return { port: cfg.clash.port, secret: cfg.clash.secret };
}

function read_status() {
	try {
		return json(readfile(RUN_DIR + '/status.json') ?? 'null') ?? {};
	}
	catch (e) {
		return {};
	}
}

const CRON_TAG = '# we1ssconnect';
const CRON = { '1h': '0 * * * *', '3h': '0 */3 * * *', '6h': '0 */6 * * *', '12h': '0 */12 * * *', '1d': '30 4 * * *' };

function sync_cron(interval) {
	const file = '/etc/crontabs/root';
	const old = readfile(file) ?? '';
	let kept = filter(split(old, '\n'), (l) => l != '' && index(l, CRON_TAG) < 0);
	if (CRON[interval])
		push(kept, `${CRON[interval]} /usr/bin/we1ssconnect sub-update all >/dev/null 2>&1 ${CRON_TAG}`);
	const fresh = join('\n', kept) + '\n';
	if (fresh != old) {
		writefile(file, fresh);
		sh('/etc/init.d/cron restart');
	}
}

// Builds and checks everything before the service touches the network: a config sing-box
// rejects leaves nft and dnsmasq as they are.
export function prepare() {
	mkdir(RUN_DIR);
	mkdir(TMP_DIR);
	const l = load_cfg();
	const cfg = l.cfg;
	const res = lists.resolve(cfg, (url) => lists.fetch_cached(url, TMP_DIR + '/lists', null));
	const built = singbox.build(cfg, l.data);
	writefile(RUN_DIR + '/config.json', sprintf('%.J\n', built.config));
	const check = sh(`sing-box check -c ${RUN_DIR}/config.json`);
	const rules = nft.render({
		mode: cfg.mode, ifaces: cfg.ifaces, route_subnets: res.route_subnets, devices: cfg.devices,
		intercept_dns: cfg.intercept_dns, exclude_ntp: cfg.exclude_ntp, ipv6: cfg.ipv6,
	});
	writefile(RUN_DIR + '/rules.nft', rules);
	const status = {
		ok: check.code == 0, error: check.code == 0 ? null : check.out,
		warnings: [ ...l.errors, ...built.errors, ...map(res.missing, (u) => `list not downloaded: ${u}`) ],
		mode: cfg.mode, ipv6: cfg.ipv6, manage_dnsmasq: cfg.manage_dnsmasq, prepared: time(),
	};
	writefile(RUN_DIR + '/status.json', sprintf('%J', status));
	sync_cron(cfg.sub_update_interval);
	return status;
};

export function apply_net() {
	const st = read_status();
	const r = sh(`nft -f ${RUN_DIR}/rules.nft`);
	if (r.code != 0)
		return { ok: false, error: 'nft: ' + r.out };
	for (let cmd in nft.route_commands(true, st.ipv6))
		sh(cmd);
	let err = null;
	if (st.manage_dnsmasq)
		err = dnsmasq.apply(cursor());
	return { ok: err == null, error: err };
};

export function cleanup() {
	sh(`nft delete table inet ${nft.TABLE}`);
	for (let cmd in nft.route_commands(false, true))
		sh(cmd);
	dnsmasq.restore(cursor());
	return { ok: true };
};

function server_view(s, proxies) {
	const tag = singbox.server_tag(s.id);
	const hist = proxies?.[tag]?.history;
	let v = { id: s.id, name: s.name, source: s.source, ok: s.ok, type: s.outbound?.type, reason: s.reason };
	if (s.outbound)
		v.address = `${s.outbound.server ?? s.outbound.peers?.[0]?.address}:${s.outbound.server_port ?? s.outbound.peers?.[0]?.port}`;
	if (length(hist))
		v.delay = hist[length(hist) - 1].delay || -1;
	return v;
}

export function status() {
	const l = load_cfg();
	const st = read_status();
	const up = sh('pidof sing-box').code == 0 && sh(`nft list table inet ${nft.TABLE}`).code == 0;
	let out = {
		version: VERSION, enabled: l.cfg.enabled, running: up, mode: l.cfg.mode, selected: l.cfg.selected,
		error: st.error, warnings: st.warnings ?? [], servers: length(store.usable(l.data)),
		singbox: split(sh('sing-box version').out, '\n')[0],
	};
	if (up) {
		const p = clash.proxies(api(l.cfg));
		if (!p.error) {
			out.now = p.main?.now == 'auto' ? p.auto?.now : p.main?.now;
			out.auto = p.main?.now == 'auto';
			const c = clash.connections(api(l.cfg));
			if (c && !c.error)
				out.traffic = { up: c.uploadTotal, down: c.downloadTotal, connections: length(c.connections ?? []) };
		}
	}
	return out;
};

export function servers() {
	const l = load_cfg();
	const p = status().running ? clash.proxies(api(l.cfg)) : null;
	let subs = {};
	for (let s in l.cfg.subscriptions)
		subs[s.id] = { ...s, ...(l.data.subscriptions[s.id] ?? {}) };
	return {
		selected: l.cfg.selected, now: p?.main?.now == 'auto' ? p?.auto?.now : p?.main?.now,
		servers: map(l.data.servers, (s) => server_view(s, p?.error ? null : p)),
		subscriptions: subs,
		groups: map(l.cfg.groups, (g) => ({ id: g.id, name: g.name, servers: g.servers })),
	};
};

// Delays: through the tunnel when it runs, else TCP connect time (ICMP for UDP protocols).
export function ping() {
	const l = load_cfg();
	if (status().running) {
		const r = clash.group_delay(api(l.cfg), 'auto', l.cfg.urltest.url, 5000);
		if (r.error)
			return r;
		let out = {};
		for (let s in store.usable(l.data))
			out[s.id] = r[singbox.server_tag(s.id)] ?? -1;
		return { via: 'tunnel', delays: out };
	}
	// Each line: "<id> ms <value>" from ping, "<id> s <value>" from curl's connect time.
	const icmp = "awk -F'time=' 'NF > 1 { split($2, a, \" \"); print a[1]; exit }'";
	let script = '';
	for (let s in store.usable(l.data)) {
		const o = s.outbound;
		const host = o.server ?? o.peers?.[0]?.address, port = o.server_port ?? o.peers?.[0]?.port;
		const url = 'http://' + (index(host, ':') >= 0 ? '[' + host + ']' : host) + ':' + port + '/';
		if (o.type == 'hysteria2' || o.type == 'tuic' || o.type == 'wireguard')
			script += sprintf('(echo "%s ms $(ping -c 1 -W 2 %s 2>/dev/null | %s)") &\n', s.id, q(host), icmp);
		else
			script += sprintf("(echo \"%s s $(curl -so /dev/null -m 3 -w '%%{time_connect}' %s)\") &\n", s.id, q(url));
	}
	let out = {};
	for (let line in split(sh(script + 'wait').out, '\n')) {
		const m = match(line, /^([0-9a-f]+) (ms|s) ?([0-9.]*)$/);
		if (!m)
			continue;
		const v = +(m[3] || 0) * (m[2] == 's' ? 1000 : 1);
		out[m[1]] = v > 0 ? int(v) : -1;
	}
	return { via: 'direct', delays: out };
};

export function select(id) {
	const l = load_cfg();
	if (id != 'auto' && !store.find(l.data, id))
		return { ok: false, error: 'no such server' };
	let c = cursor();
	c.load('we1ssconnect');
	c.set('we1ssconnect', 'main', 'selected', id);
	c.commit('we1ssconnect');
	if (status().running)
		return clash.select(api(l.cfg), 'main', id == 'auto' ? 'auto' : singbox.server_tag(id));
	return { ok: true };
};

function restart_if_running() {
	if (status().running)
		sh('/etc/init.d/we1ssconnect restart');
}

export function import_links(text) {
	let data = store.load();
	const added = store.add_links(data, text);
	store.save(data);
	if (length(filter(added, (s) => s.ok)))
		restart_if_running();
	return { added: length(filter(added, (s) => s.ok)), skipped: map(filter(added, (s) => !s.ok), (s) => ({ name: s.name, reason: s.reason })) };
};

export function remove_server(id) {
	let data = store.load();
	const ok = store.remove(data, id);
	store.save(data);
	if (ok)
		restart_if_running();
	return { ok };
};

export function sub_add(name, url) {
	let c = cursor();
	c.load('we1ssconnect');
	const id = 'sub_' + store.new_id();
	c.set('we1ssconnect', id, 'subscription');
	c.set('we1ssconnect', id, 'name', name || '');
	c.set('we1ssconnect', id, 'url', url);
	c.set('we1ssconnect', id, 'enabled', '1');
	c.commit('we1ssconnect');
	return { id, ...sub_update(id, true) };
};

export function sub_update(which, no_restart) {
	const l = load_cfg();
	let data = l.data, results = {}, changed = false;
	for (let s in l.cfg.subscriptions) {
		if ((which != 'all' && which != s.id) || (which == 'all' && !s.enabled) || !s.url)
			continue;
		const before = sprintf('%J', map(filter(data.servers, (x) => x.source == s.id), (x) => x.outbound));
		results[s.id] = sub.update(data, s.id, s.url, s.user_agent || user_agent());
		if (s.filter && !results[s.id].error) {
			const re = regexp(s.filter, 'i');
			data.servers = filter(data.servers, (x) => x.source != s.id || match(x.name, re));
		}
		changed ||= before != sprintf('%J', map(filter(data.servers, (x) => x.source == s.id), (x) => x.outbound));
	}
	store.save(data);
	if (changed && !no_restart)
		restart_if_running();
	return { results, changed };
};

export function sub_remove(id) {
	let c = cursor();
	c.load('we1ssconnect');
	c.delete('we1ssconnect', id);
	c.commit('we1ssconnect');
	let data = store.load();
	store.remove_source(data, id);
	store.save(data);
	restart_if_running();
	return { ok: true };
};

export function exit_info() {
	for (let src in ['https://api.ip.sb/geoip', 'https://ipwho.is/']) {
		const r = sh(`curl -s -m 8 -x ${SVC_PROXY} ${q(src)}`);
		try {
			const j = json(r.out);
			if (j?.ip)
				return { ip: j.ip, country: j.country, country_code: j.country_code, city: j.city, isp: j.isp ?? j.organization ?? j.connection?.isp };
		}
		catch (e) {}
	}
	return { error: 'no answer through the tunnel' };
};

export function speedtest() {
	const r = sh(`curl -s -m 15 -o /dev/null -x ${SVC_PROXY} -w '%{speed_download} %{size_download}' 'https://speed.cloudflare.com/__down?bytes=50000000'`);
	const m = match(r.out, /^([0-9.]+) ([0-9]+)/);
	if (!m || +m[2] == 0)
		return { error: 'download through the tunnel failed' };
	return { mbps: int(+m[1] * 8 / 10000) / 100, bytes: int(m[2]) };
};

export function diagnostics() {
	const l = load_cfg();
	const st = read_status();
	let checks = [];
	function add(name, ok, detail) {
		push(checks, { name, ok, detail: detail ?? '' });
	}
	const ver = sh('sing-box version');
	add('sing-box', ver.code == 0, split(ver.out, '\n')[0]);
	add('config', st.ok == true, st.error ?? (st.prepared ? '' : 'not built yet'));
	add('service', sh('pidof sing-box').code == 0);
	add('nftables', sh(`nft list table inet ${nft.TABLE}`).code == 0);
	add('tproxy module', sh('grep -q nft_tproxy /proc/modules || ls /lib/modules/*/nft_tproxy.ko').code == 0);
	add('policy routing', index(sh('ip rule').out, `lookup ${nft.ROUTE_TABLE}`) >= 0);
	if (l.cfg.manage_dnsmasq) {
		let c = cursor();
		c.load('dhcp');
		let servers = [];
		c.foreach('dhcp', 'dnsmasq', (s) => { push(servers, ...(type(s.server) == 'array' ? s.server : [])); });
		add('dnsmasq → sing-box', index(servers, singbox.DNS_LISTEN) >= 0, join(', ', servers));
	}
	add('DNS through sing-box', sh(`nslookup -timeout=3 example.com ${singbox.DNS_LISTEN}`).code == 0);
	const tunnel = sh(`curl -s -o /dev/null -m 8 -w '%{http_code}' -x ${SVC_PROXY} ${q(l.cfg.urltest.url)}`);
	add('tunnel', tunnel.out == '204' || tunnel.out == '200', tunnel.out);
	for (let pkg in ['podkop', 'luci-app-passwall', 'luci-app-passwall2', 'https-dns-proxy'])
		if (stat('/usr/lib/opkg/info/' + pkg + '.control') || stat('/lib/apk/packages/' + pkg + '.list'))
			add('conflict: ' + pkg, false, 'installed');
	return { checks, warnings: st.warnings ?? [] };
};

export function logs(lines) {
	return { log: sh(`logread -e sing-box -e we1ssconnect | tail -n ${int(lines ?? 200)}`).out };
};

export function update_check() {
	const r = sh(`curl -s -m 10 https://api.github.com/repos/${REPO}/releases/latest`);
	try {
		const j = json(r.out);
		return { current: VERSION, latest: replace(j.tag_name ?? '', /^v/, ''), url: j.html_url, notes: j.body };
	}
	catch (e) {
		return { current: VERSION, error: 'GitHub did not answer' };
	}
};

export function self_update() {
	sh(`(sleep 1; wget -qO- https://raw.githubusercontent.com/${REPO}/main/openwrt/install.sh | sh) >/tmp/we1ssconnect-update.log 2>&1 &`);
	return { ok: true, log: '/tmp/we1ssconnect-update.log' };
};
