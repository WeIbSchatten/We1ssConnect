// Share links (vless, vmess, trojan, ss, hysteria2, tuic, wireguard, socks, anytls) to
// sing-box outbounds. Links sing-box cannot serve come back with ok=false and a reason.

import { urldecode, pctdecode, b64decode, parse_url, csv, truthy } from 'we1ssconnect.util';

const UNSUPPORTED_NETS = { xhttp: 'xhttp', splithttp: 'xhttp', kcp: 'kcp', mkcp: 'kcp', quic: 'quic' };

function fail(name, reason) {
	return { ok: false, name, reason };
}

function default_name(type, host, port) {
	return `${type} ${index(host, ':') >= 0 ? '[' + host + ']' : host}:${port}`;
}

// Params use the Xray share-link names: security, sni, alpn, fp, pbk, sid, allowInsecure.
function build_tls(p, host, force) {
	const security = lc(p.security ?? '');
	if (!force && security != 'tls' && security != 'reality')
		return null;
	let tls = { enabled: true, server_name: p.sni || p.peer || host };
	if (truthy(p.allowInsecure) || truthy(p.insecure) || truthy(p.allow_insecure))
		tls.insecure = true;
	const alpn = csv(p.alpn);
	if (length(alpn))
		tls.alpn = alpn;
	if (p.fp || security == 'reality')
		tls.utls = { enabled: true, fingerprint: p.fp || 'chrome' };
	if (security == 'reality') {
		tls.reality = { enabled: true, public_key: p.pbk ?? '' };
		if (p.sid)
			tls.reality.short_id = p.sid;
	}
	return tls;
}

// Returns [transport or null, error or null].
function build_transport(p) {
	const net = lc(p.type ?? p.net ?? 'tcp');
	if (UNSUPPORTED_NETS[net])
		return [null, `${UNSUPPORTED_NETS[net]} transport is not supported by sing-box`];
	const host = p.host ?? '';
	if (net == 'ws') {
		let path = p.path || '/', t = { type: 'ws' };
		const ed = match(path, /^([^?]*)\?ed=([0-9]+)$/);
		if (ed) {
			path = ed[1] || '/';
			t.max_early_data = int(ed[2]);
			t.early_data_header_name = 'Sec-WebSocket-Protocol';
		}
		t.path = path;
		if (host)
			t.headers = { Host: host };
		return [t, null];
	}
	if (net == 'grpc')
		return [{ type: 'grpc', service_name: p.serviceName ?? p.path ?? '' }, null];
	if (net == 'httpupgrade') {
		let t = { type: 'httpupgrade', path: p.path || '/' };
		if (host)
			t.host = host;
		return [t, null];
	}
	if (net == 'h2' || net == 'http' || ((net == 'tcp' || net == 'raw') && lc(p.headerType ?? '') == 'http')) {
		let t = { type: 'http', path: p.path || '/' };
		if (host)
			t.host = csv(host);
		return [t, null];
	}
	if (net == 'tcp' || net == 'raw' || net == '')
		return [null, null];
	return [null, `${net} transport is not supported by sing-box`];
}

function with_stream(out, p, host, name, force_tls) {
	const tr = build_transport(p);
	if (tr[1])
		return fail(name, tr[1]);
	const tls = build_tls(p, host, force_tls);
	if (tls)
		out.tls = tls;
	if (tr[0])
		out.transport = tr[0];
	return { ok: true, name, outbound: out };
}

function need_address(u, name) {
	if (!u.host)
		return fail(name, 'missing host');
	if (!u.port)
		return fail(name, 'missing port');
	return null;
}

function parse_vless(u) {
	const name = u.fragment || default_name('vless', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	let out = { type: 'vless', server: u.host, server_port: u.port, uuid: pctdecode(u.userinfo ?? ''), packet_encoding: 'xudp' };
	if (u.query.flow)
		out.flow = u.query.flow;
	return with_stream(out, u.query, u.host, name, false);
}

function parse_vmess(link) {
	const raw = b64decode(substr(link, 8));
	let j = null;
	try {
		j = json(raw);
	}
	catch (e) {
		return fail(link, 'vmess link is not base64 JSON');
	}
	const host = j.add, port = int(j.port ?? 0);
	const name = j.ps || default_name('vmess', host, port);
	if (!host || !port)
		return fail(name, !host ? 'missing host' : 'missing port');
	const net = j.net ?? 'tcp';
	const p = {
		type: net, security: j.tls, sni: j.sni, alpn: j.alpn, fp: j.fp, host: j.host, path: j.path,
		serviceName: net == 'grpc' ? j.path : null, headerType: j.type, allowInsecure: j.allowInsecure,
		pbk: j.pbk, sid: j.sid,
	};
	let out = {
		type: 'vmess', server: host, server_port: port, uuid: j.id, security: j.scy || 'auto',
		alter_id: int(j.aid ?? 0), packet_encoding: 'xudp',
	};
	return with_stream(out, p, host, name, false);
}

function parse_trojan(u) {
	const name = u.fragment || default_name('trojan', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	const security = lc(u.query.security ?? 'tls');
	if (security == 'none')
		return with_stream({ type: 'trojan', server: u.host, server_port: u.port, password: pctdecode(u.userinfo ?? '') }, u.query, u.host, name, false);
	let p = { ...u.query, security };
	return with_stream({ type: 'trojan', server: u.host, server_port: u.port, password: pctdecode(u.userinfo ?? '') }, p, u.host, name, true);
}

function split_pair(s) {
	const i = index(s ?? '', ':');
	return i < 0 ? [s, ''] : [substr(s, 0, i), substr(s, i + 1)];
}

function parse_ss(link, u) {
	if (u.userinfo == null) {
		// Legacy form: ss://base64(method:password@host:port)#name
		const body = match(link, /^ss:\/\/([^#?]*)/i)[1];
		const decoded = b64decode(pctdecode(body));
		if (!decoded || index(decoded, '@') < 0)
			return fail(u.fragment || link, 'shadowsocks link is not readable');
		// The decoded text is not URL-encoded, so the password may hold "?" or "#".
		const m = match(decoded, /^(.*)@\[?([^\]@]*)\]?:([0-9]+)$/);
		if (!m)
			return fail(u.fragment || link, 'shadowsocks link is not readable');
		const pair = split_pair(m[1]);
		const host = m[2], port = int(m[3]);
		return { ok: true, name: u.fragment || default_name('shadowsocks', host, port),
			outbound: { type: 'shadowsocks', server: host, server_port: port, method: pair[0], password: pair[1] } };
	}
	const name = u.fragment || default_name('shadowsocks', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	const decoded = b64decode(u.userinfo);
	const pair = split_pair((decoded && index(decoded, ':') >= 0) ? decoded : pctdecode(u.userinfo));
	let out = { type: 'shadowsocks', server: u.host, server_port: u.port, method: pair[0], password: pair[1] };
	if (u.query.plugin) {
		const parts = split(u.query.plugin, ';');
		let plugin = parts[0];
		if (plugin == 'simple-obfs')
			plugin = 'obfs-local';
		if (plugin != 'obfs-local' && plugin != 'v2ray-plugin')
			return fail(name, `shadowsocks plugin ${plugin} is not supported by sing-box`);
		out.plugin = plugin;
		out.plugin_opts = join(';', slice(parts, 1));
	}
	return { ok: true, name, outbound: out };
}

function parse_hysteria2(u) {
	const name = u.fragment || default_name('hysteria2', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	const p = u.query;
	let out = { type: 'hysteria2', server: u.host, server_port: u.port, password: pctdecode(u.userinfo ?? '') };
	const hops = csv(p.mport ?? p.ports);
	if (length(hops))
		out.server_ports = map(hops, (r) => replace(r, '-', ':'));
	if (p.obfs && p.obfs != 'none')
		out.obfs = { type: p.obfs, password: p['obfs-password'] ?? '' };
	let tls = build_tls({ ...p, security: 'tls' }, u.host, true);
	if (!tls.alpn)
		tls.alpn = ['h3'];
	out.tls = tls;
	return { ok: true, name, outbound: out };
}

function parse_tuic(u) {
	const name = u.fragment || default_name('tuic', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	const p = u.query, cred = split_pair(pctdecode(u.userinfo ?? ''));
	let out = { type: 'tuic', server: u.host, server_port: u.port, uuid: cred[0], password: cred[1] };
	if (p.congestion_control)
		out.congestion_control = p.congestion_control;
	if (p.udp_relay_mode)
		out.udp_relay_mode = p.udp_relay_mode;
	out.tls = build_tls({ ...p, security: 'tls' }, u.host, true);
	return { ok: true, name, outbound: out };
}

function parse_wireguard(u) {
	const name = u.fragment || default_name('wireguard', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	const p = u.query;
	let peer = {
		address: u.host, port: u.port, public_key: p.publickey ?? p.peer_public_key ?? '',
		allowed_ips: length(csv(p.allowedips)) ? csv(p.allowedips) : ['0.0.0.0/0', '::/0'],
	};
	const psk = p.presharedkey ?? p.psk;
	if (psk)
		peer.pre_shared_key = psk;
	const reserved = csv(p.reserved);
	if (length(reserved))
		peer.reserved = map(reserved, (x) => int(x));
	let out = { type: 'wireguard', address: csv(p.address ?? p.ip), private_key: pctdecode(u.userinfo ?? ''), peers: [peer] };
	if (p.mtu)
		out.mtu = int(p.mtu);
	return { ok: true, name, endpoint: true, outbound: out };
}

function parse_socks(u) {
	const name = u.fragment || default_name('socks', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	let out = { type: 'socks', server: u.host, server_port: u.port, version: '5' };
	if (u.userinfo != null) {
		const decoded = b64decode(u.userinfo);
		const cred = split_pair((decoded && index(decoded, ':') >= 0) ? decoded : pctdecode(u.userinfo));
		out.username = cred[0];
		out.password = cred[1];
	}
	return { ok: true, name, outbound: out };
}

function parse_anytls(u) {
	const name = u.fragment || default_name('anytls', u.host, u.port);
	const bad = need_address(u, name);
	if (bad)
		return bad;
	let out = { type: 'anytls', server: u.host, server_port: u.port, password: pctdecode(u.userinfo ?? '') };
	out.tls = build_tls({ ...u.query, security: 'tls' }, u.host, true);
	return { ok: true, name, outbound: out };
}

// sing-box refuses the whole config over one outbound without its credentials, so such
// servers are rejected here with a reason instead.
const REQUIRED = {
	vless: ['uuid'], vmess: ['uuid'], trojan: ['password'], shadowsocks: ['method', 'password'],
	hysteria2: ['password'], tuic: ['uuid'], anytls: ['password'], wireguard: ['private_key'],
};

function validate(r) {
	if (!r.ok)
		return r;
	for (let k in REQUIRED[r.outbound.type] ?? [])
		if (r.outbound[k] == null || r.outbound[k] == '')
			return fail(r.name, `missing ${k == 'private_key' ? 'private key' : k}`);
	if (r.outbound.type == 'wireguard' && r.outbound.peers[0].public_key == '')
		return fail(r.name, 'missing public key');
	return r;
}

function parse_link(link) {
	link = trim(link ?? '');
	const shown = length(link) > 60 ? substr(link, 0, 60) + '…' : link;
	if (match(link, /^vmess:\/\//i))
		return parse_vmess(link);
	const u = parse_url(link);
	if (!u)
		return fail(shown, 'not a share link');
	switch (u.scheme) {
	case 'vless': return parse_vless(u);
	case 'trojan': return parse_trojan(u);
	case 'ss': return parse_ss(link, u);
	case 'hysteria2':
	case 'hy2': return parse_hysteria2(u);
	case 'tuic': return parse_tuic(u);
	case 'wireguard':
	case 'wg': return parse_wireguard(u);
	case 'socks':
	case 'socks5': return parse_socks(u);
	case 'anytls': return parse_anytls(u);
	}
	return fail(u.fragment || shown, `unknown link type ${u.scheme}`);
}

export function parse(link) {
	return validate(parse_link(link));
};

// A subscription body or pasted text: one link per line, plain or base64 as a whole.
export function parse_all(body) {
	let text = trim(body ?? '');
	if (index(text, '://') < 0) {
		const decoded = b64decode(text);
		if (decoded && index(decoded, '://') >= 0)
			text = decoded;
	}
	let out = [];
	for (let line in split(text, /\r?\n/)) {
		line = trim(line);
		if (line != '')
			push(out, parse(line));
	}
	return out;
};
