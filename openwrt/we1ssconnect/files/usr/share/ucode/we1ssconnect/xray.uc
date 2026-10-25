// Xray beside sing-box for REALITY servers: Xray >= 26.9.8 servers reject sing-box's ClientHello
// (no X25519MLKEM768 key share, SagerNet/sing-box#4520), so sing-box reaches them through Xray.

export const PINNED = '26.10.21';
// The oldest Xray checked to pass the new REALITY servers; the 24.10 feed's 25.1.30 fails.
export const MIN_VERSION = '26.3.27';
export const BASE_PORT = 10900;
export const PATH = '/usr/share/we1ssconnect/xray';

const ARCHES = [
	[/^aarch64/, 'arm64-v8a'], [/^x86_64/, '64'], [/^i386/, '32'], [/^arm_.*(cortex-a|neon|vfpv)/, 'arm32-v7a'],
	[/^arm_arm11/, 'arm32-v6'], [/^arm_/, 'arm32-v5'], [/^mipsel_/, 'mips32le'], [/^mips_/, 'mips32'],
	[/^mips64el_/, 'mips64le'], [/^mips64_/, 'mips64'], [/^riscv64/, 'riscv64'], [/^loongarch64/, 'loong64'],
];

// DISTRIB_ARCH of /etc/openwrt_release → the Xray release zip, or null.
export function asset(arch) {
	for (let a in ARCHES)
		if (match(arch ?? '', a[0]))
			return `Xray-linux-${a[1]}.zip`;
	return null;
};

export function version_ok(v) {
	const a = map(split(v ?? '', '.'), (x) => int(x)), b = map(split(MIN_VERSION, '.'), (x) => int(x));
	if (!match(v ?? '', /^[0-9]+\.[0-9]+\.[0-9]+$/))
		return false;
	for (let i = 0; i < 3; i++)
		if (a[i] != b[i])
			return a[i] > b[i];
	return true;
};

// Only what Xray can carry for sing-box: REALITY over raw TCP or gRPC.
export function wanted(s) {
	const o = s.outbound;
	return !!(s.ok && o?.tls?.reality?.enabled && (o.type == 'vless' || o.type == 'trojan')
		&& (!o.transport || o.transport.type == 'grpc'));
};

const LOG_LEVELS = { trace: 'debug', debug: 'debug', info: 'info', warn: 'warning', error: 'error', fatal: 'error', panic: 'error' };

function outbound(o, tag, cfg) {
	let x = { tag, protocol: o.type };
	if (o.type == 'vless')
		x.settings = { vnext: [{ address: o.server, port: o.server_port,
			users: [{ id: o.uuid, flow: o.flow ?? '', encryption: 'none' }] }] };
	else
		x.settings = { servers: [{ address: o.server, port: o.server_port, password: o.password }] };
	const r = o.tls.reality;
	let st = {
		network: o.transport ? 'grpc' : 'raw',
		security: 'reality',
		realitySettings: { serverName: o.tls.server_name, fingerprint: o.tls.utls?.fingerprint ?? 'chrome',
			publicKey: r.public_key, shortId: r.short_id ?? '' },
		// Marked like sing-box's own traffic and resolved directly: a FakeIP answer would loop back.
		sockopt: { mark: 255, domainStrategy: cfg.ipv6 ? 'UseIP' : 'UseIPv4' },
	};
	if (o.transport)
		st.grpcSettings = { serviceName: o.transport.service_name ?? '' };
	x.streamSettings = st;
	return x;
}

// servers: stored servers with tuned outbounds. Returns { config, ports: { <id>: port } } or null.
export function build(cfg, servers) {
	let inbounds = [], outbounds = [], rules = [], ports = {};
	for (let s in servers) {
		if (!wanted(s))
			continue;
		const port = BASE_PORT + length(inbounds);
		ports[s.id] = port;
		push(inbounds, { tag: 'in-' + s.id, listen: '127.0.0.1', port, protocol: 'socks', settings: { auth: 'noauth', udp: true } });
		push(outbounds, outbound(s.outbound, 'out-' + s.id, cfg));
		push(rules, { type: 'field', inboundTag: ['in-' + s.id], outboundTag: 'out-' + s.id });
	}
	if (!length(inbounds))
		return null;
	return { ports, config: {
		log: { loglevel: LOG_LEVELS[cfg.log_level] ?? 'warning' },
		dns: { servers: [cfg.dns.direct], queryStrategy: cfg.ipv6 ? 'UseIP' : 'UseIPv4' },
		inbounds, outbounds,
		routing: { rules },
	} };
};
