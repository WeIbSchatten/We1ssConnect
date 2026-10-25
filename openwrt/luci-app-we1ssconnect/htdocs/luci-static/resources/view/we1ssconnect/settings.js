'use strict';
'require view';
'require form';
'require tools.widgets as widgets';
'require we1ssconnect.common as w1';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('we1ssconnect', null, _('Changes apply after Save & Apply; the tunnel restarts.'));
		w1.style();

		s = m.section(form.NamedSection, 'main', 'settings');
		s.tab('dns', _('DNS'));
		s.tab('net', _('Network'));
		s.tab('tunnel', _('Connection'));
		s.tab('lists', _('Lists and subscriptions'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('dns', form.ListValue, 'dns_type', _('DNS protocol'));
		o.value('doh', _('DNS over HTTPS'));
		o.value('dot', _('DNS over TLS'));
		o.value('udp', _('Plain UDP'));

		o = s.taboption('dns', form.Value, 'dns_server', _('DNS server'), _('Resolver for everything not sent directly. Address or DoH URL.'));
		o.value('1.1.1.1', 'Cloudflare (1.1.1.1)');
		o.value('8.8.8.8', 'Google (8.8.8.8)');
		o.value('9.9.9.9', 'Quad9 (9.9.9.9)');
		o.value('https://dns.adguard-dns.com/dns-query', 'AdGuard DNS');
		o.rmempty = false;

		o = s.taboption('dns', form.Value, 'direct_dns', _('DNS for direct sites'), _('Used for direct rules, so Russian sites reach their nearest servers.'));
		o.value('77.88.8.8', _('Yandex (77.88.8.8)'));
		o.value('1.1.1.1', 'Cloudflare (1.1.1.1)');
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = s.taboption('dns', form.Value, 'bootstrap_dns', _('Bootstrap DNS'), _('Resolves the DNS server name when it is not an address.'));
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = s.taboption('dns', form.Flag, 'intercept_dns', _('Catch hard-coded DNS'), _('Devices that use their own DNS server (8.8.8.8 and the like) are answered by the router too.'));
		o.default = '1';

		o = s.taboption('dns', form.Flag, 'manage_dnsmasq', _('Point dnsmasq at the tunnel'), _('Turn off only if you configure dnsmasq yourself (server=127.0.0.42).'));
		o.default = '1';

		o = s.taboption('net', widgets.DeviceSelect, 'source_iface', _('LAN interfaces'), _('Traffic from these interfaces is handled. Usually br-lan.'));
		o.multiple = true;
		o.noaliases = true;
		o.nocreate = true;

		o = s.taboption('net', form.Flag, 'ipv6', _('IPv6'), _('Resolve and route IPv6 too. Many servers have no IPv6, so it is off by default.'));

		o = s.taboption('net', form.Flag, 'exclude_ntp', _('Keep NTP direct'), _('Time sync stays out of the tunnel (helps smart speakers).'));
		o.default = '1';

		o = s.taboption('net', form.Flag, 'block_quic', _('Block QUIC through the tunnel'), _('Browsers fall back to TCP; sometimes fixes YouTube.'));

		o = s.taboption('net', form.Flag, 'lan_proxy', _('Proxy for the LAN'), _('SOCKS5/HTTP proxy on the router for apps and devices that need one.'));
		o = s.taboption('net', form.Value, 'lan_proxy_port', _('Proxy port'));
		o.datatype = 'port';
		o.default = '2080';
		o.depends('lan_proxy', '1');

		o = s.taboption('tunnel', form.Flag, 'force_chrome_fp', _('Chrome fingerprint for Reality'),
			_('Reality servers on Xray 26.9.8 and newer drop some fingerprints; chrome always works.'));
		o.default = '1';

		o = s.taboption('tunnel', form.Flag, 'fragment', _('Fragment TLS'), _('Splits the TLS ClientHello so DPI cannot read the server name in one packet (not for Reality).'));

		o = s.taboption('tunnel', form.Value, 'urltest_url', _('Delay test URL'));
		o.default = 'https://www.gstatic.com/generate_204';

		o = s.taboption('tunnel', form.ListValue, 'urltest_interval', _('Test interval'));
		[ '1m', '3m', '5m', '10m' ].forEach((v) => o.value(v, v));
		o.default = '3m';

		o = s.taboption('tunnel', form.Value, 'urltest_tolerance', _('Switch threshold, ms'), _('Auto moves to another server only when it is this much faster.'));
		o.datatype = 'uinteger';
		o.default = '50';

		o = s.taboption('lists', form.ListValue, 'list_update_interval', _('Refresh lists'));
		[ [ '6h', _('every 6 hours') ], [ '12h', _('every 12 hours') ], [ '1d', _('daily') ], [ '3d', _('every 3 days') ] ].forEach((v) => o.value(v[0], v[1]));
		o.default = '1d';

		o = s.taboption('lists', form.Flag, 'lists_via_tunnel', _('Download lists through the tunnel'), _('Useful when GitHub is blocked.'));

		o = s.taboption('lists', form.ListValue, 'sub_update_interval', _('Refresh subscriptions'));
		[ [ '1h', _('hourly') ], [ '3h', _('every 3 hours') ], [ '6h', _('every 6 hours') ], [ '12h', _('every 12 hours') ], [ '1d', _('daily') ], [ 'off', _('never') ] ].forEach((v) => o.value(v[0], v[1]));
		o.default = '12h';

		o = s.taboption('advanced', form.ListValue, 'log_level', _('Log level'));
		[ 'error', 'warn', 'info', 'debug' ].forEach((v) => o.value(v, v));
		o.default = 'warn';

		o = s.taboption('advanced', form.Value, 'clash_port', _('Control API port'), _('Local sing-box API used by this page (127.0.0.1 only).'));
		o.datatype = 'port';
		o.default = '9090';

		return m.render();
	},
});
