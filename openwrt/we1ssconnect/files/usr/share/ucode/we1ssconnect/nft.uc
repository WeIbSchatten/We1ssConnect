// nftables ruleset for the TPROXY interception, rendered as one `nft -f` file that replaces
// the previous table atomically.

import { TPROXY_PORT, ROUTING_MARK, FAKEIP_V4, FAKEIP_V6 } from 'we1ssconnect.singbox';

export const TABLE = 'we1ssconnect';
export const FWMARK = '0x00100000';
export const ROUTE_TABLE = 105;

const RESERVED_V4 = [
	'0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
	'192.0.0.0/24', '192.168.0.0/16', '224.0.0.0/4', '240.0.0.0/4',
];
const RESERVED_V6 = ['::1/128', 'fe80::/10', 'fd00::/8', 'ff00::/8'];

function set(name, typ, elements) {
	let s = `\tset ${name} {\n\t\ttype ${typ}\n\t\tflags interval\n\t\tauto-merge\n`;
	if (length(elements))
		s += `\t\telements = { ${join(', ', elements)} }\n`;
	return s + '\t}\n';
}

function is_v6(cidr) {
	return index(cidr, ':') >= 0;
}

// opts: { mode, ifaces, route_subnets, devices, intercept_dns, exclude_ntp, ipv6 }
export function render(opts) {
	const global = opts.mode == 'global';
	const v6 = opts.ipv6;
	const tunnel = map(filter(opts.devices, (d) => d.mode == 'tunnel'), (d) => d.ip);
	const bypass = map(filter(opts.devices, (d) => d.mode == 'bypass'), (d) => d.ip);
	const routes = opts.route_subnets ?? [];
	const tp4 = `meta l4proto { tcp, udp } meta mark set ${FWMARK} tproxy ip to 127.0.0.1:${TPROXY_PORT} accept`;
	const tp6 = `meta l4proto { tcp, udp } meta mark set ${FWMARK} tproxy ip6 to [::1]:${TPROXY_PORT} accept`;
	const ifaces = join(', ', map(opts.ifaces, (i) => `"${i}"`));

	let t = `table inet ${TABLE}\ndelete table inet ${TABLE}\ntable inet ${TABLE} {\n`;
	t += set('fakeip4', 'ipv4_addr', [FAKEIP_V4]);
	t += set('reserved4', 'ipv4_addr', RESERVED_V4);
	t += set('route4', 'ipv4_addr', filter(routes, (c) => !is_v6(c)));
	t += set('tunnel4', 'ipv4_addr', tunnel);
	t += set('bypass4', 'ipv4_addr', bypass);
	if (v6) {
		t += set('fakeip6', 'ipv6_addr', [FAKEIP_V6]);
		t += set('reserved6', 'ipv6_addr', RESERVED_V6);
		t += set('route6', 'ipv6_addr', filter(routes, (c) => is_v6(c)));
	}

	t += '\tchain prerouting {\n\t\ttype filter hook prerouting priority mangle; policy accept;\n';
	// Router-originated packets rerouted to lo by the output chain below.
	t += `\t\tiifname "lo" meta mark & ${FWMARK} == ${FWMARK} ip daddr @fakeip4 ${tp4}\n`;
	t += `\t\tiifname != { ${ifaces} } return\n`;
	// FakeIP answers must reach sing-box for every device, bypassed ones included.
	t += `\t\tip daddr @fakeip4 ${tp4}\n`;
	if (v6)
		t += `\t\tip6 daddr @fakeip6 ${tp6}\n`;
	t += '\t\tip saddr @bypass4 return\n';
	if (opts.exclude_ntp)
		t += '\t\tudp dport 123 return\n';
	if (opts.intercept_dns && !global)
		t += `\t\tip daddr != @reserved4 meta l4proto { tcp, udp } th dport 53 meta mark set ${FWMARK} tproxy ip to 127.0.0.1:${TPROXY_PORT} accept\n`;
	t += '\t\tip daddr @reserved4 return\n';
	t += `\t\tip saddr @tunnel4 ${tp4}\n`;
	if (global) {
		t += `\t\tmeta nfproto ipv4 ${tp4}\n`;
		if (v6)
			t += `\t\tip6 daddr != @reserved6 ${tp6}\n`;
	}
	else {
		t += `\t\tip daddr @route4 ${tp4}\n`;
		if (v6)
			t += `\t\tip6 daddr @route6 ${tp6}\n`;
	}
	t += '\t}\n';

	t += '\tchain output {\n\t\ttype route hook output priority mangle; policy accept;\n';
	t += `\t\tmeta mark ${ROUTING_MARK} return\n`;
	t += `\t\tip daddr @fakeip4 meta l4proto { tcp, udp } meta mark set ${FWMARK}\n`;
	t += '\t}\n}\n';
	return t;
};

// `ip` commands that send marked packets to the local TPROXY socket.
export function route_commands(add, v6) {
	const op = add ? 'add' : 'del';
	let cmds = [
		`ip rule ${op} fwmark ${FWMARK}/${FWMARK} lookup ${ROUTE_TABLE}`,
		`ip route ${op} local 0.0.0.0/0 dev lo table ${ROUTE_TABLE}`,
	];
	if (v6)
		push(cmds, `ip -6 rule ${op} fwmark ${FWMARK}/${FWMARK} lookup ${ROUTE_TABLE}`,
			`ip -6 route ${op} local ::/0 dev lo table ${ROUTE_TABLE}`);
	return cmds;
};
