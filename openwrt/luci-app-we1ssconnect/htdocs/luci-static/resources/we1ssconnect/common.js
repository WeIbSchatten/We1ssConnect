'use strict';
'require baseclass';
'require rpc';
'require ui';
'require we1ssconnect.state as state';

// RPC calls, labels and the look shared with the other We1ssConnect clients.

const call = (method, params) => rpc.declare({ object: 'we1ssconnect', method, params: params || [], expect: { '': {} } });

const SERVICES = {
	russia_inside: _('Blocked in Russia'), russia_outside: _('Russian services from abroad'),
	ukraine_inside: _('Blocked in Ukraine'), geoblock: _('Geo-blocked services'), block: _('Blocked sites'),
	porn: _('Adult sites'), news: _('News'), anime: _('Anime'), youtube: 'YouTube', hdrezka: 'HDRezka',
	tiktok: 'TikTok', google_ai: 'Google AI (Gemini)', google_play: 'Google Play', google_meet: 'Google Meet',
	hodca: 'HODCA', discord: 'Discord', meta: 'Meta (Instagram, Facebook, WhatsApp)', twitter: 'X (Twitter)',
	cloudflare: 'Cloudflare', cloudfront: 'CloudFront', digitalocean: 'DigitalOcean', hetzner: 'Hetzner',
	ovh: 'OVH', telegram: 'Telegram', roblox: 'Roblox',
};

const PRESETS = { ru: _('Russian sites and IPs'), ads: _('Ads and trackers') };

// The service reports config problems in English (singbox.uc, config.uc); most specific first.
const WARNINGS = [
	[ /^selective mode: no rule sends traffic through the tunnel$/, () => _('Selective mode, but no enabled rule sends traffic through the tunnel: turn a rule on or switch to global mode.') ],
	[ /^global mode needs at least one server$/, () => _('Global mode needs at least one server.') ],
	[ /^REALITY servers: downloading Xray, they switch to it when it is ready$/, () => _('Downloading Xray for the REALITY servers; they switch to it when it is ready.') ],
	[ /^REALITY servers: Xray is not installed: (.+)$/, (m) => _('Xray for the REALITY servers is not installed: %s. Reconnecting tries again after an hour; or run we1ssconnect xray-install.').format(m[1]) ],
	[ /^selected server (.+) is gone; using Auto$/, (m) => _('The selected server %s is gone; using Auto.').format(m[1]) ],
	[ /^group (.+) has no usable servers$/, (m) => _('Group %s has no usable servers.').format(m[1]) ],
	[ /^rule (.+): target (.+) is not available$/, (m) => _('Rule %s: target %s is not available.').format(m[1], m[2]) ],
	[ /^rule (.+): no interface$/, (m) => _('Rule %s: no VPN interface chosen.').format(m[1]) ],
	[ /^rule (.+): bad protocol (.+)$/, (m) => _('Rule %s: unknown protocol %s.').format(m[1], m[2]) ],
	[ /^rule (.+): bad category (.+)$/, (m) => _('Rule %s: unknown category %s.').format(m[1], m[2]) ],
	[ /^(.+): bad filter (.+)$/, (m) => _('%s: invalid filter %s.').format(m[1], m[2]) ],
];

const CSS = `
:root { --w1-on: #2a9a5c; --w1-err: #d2483f; --w1-warn: #c48a1c; --w1-vpn: #3a7fd0;
	--w1-line: color-mix(in srgb, currentColor 16%, transparent); --w1-soft: color-mix(in srgb, currentColor 4%, transparent);
	--w1-hover: color-mix(in srgb, currentColor 7%, transparent); --w1-r: 14px; }
.w1-wrap { max-width: 1100px; font-variant-numeric: tabular-nums; }
.w1-head { display: flex; align-items: center; gap: 14px; margin: 4px 0 20px; flex-wrap: wrap; }
.w1-mark { width: 38px; height: 38px; flex: none; }
.w1-headtext { flex: 1; min-width: 200px; }
.w1-title { font-size: 22px; font-weight: 650; line-height: 1.15; letter-spacing: -.01em; }
.w1-sub { opacity: .62; font-size: 13px; margin-top: 2px; max-width: 72ch; }
.w1-status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; border: 1px solid var(--w1-line); border-radius: 999px; font-size: 13px; white-space: nowrap; max-width: 100%; }
.w1-status .w1-name { overflow: hidden; text-overflow: ellipsis; opacity: .7; }
.w1-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: color-mix(in srgb, currentColor 35%, transparent); }
.w1-dot.w1-on { background: var(--w1-on); box-shadow: 0 0 0 3px color-mix(in srgb, var(--w1-on) 22%, transparent); }
.w1-dot.w1-err { background: var(--w1-err); }
.w1-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 12px; }
.w1-card { border: 1px solid var(--w1-line); border-radius: var(--w1-r); padding: 16px 18px; background: var(--w1-soft); min-width: 0; }
.w1-card h4 { margin: 0 0 10px; font-size: 13px; font-weight: 600; opacity: .62; }
.w1-big { font-size: 19px; font-weight: 650; word-break: break-word; }
.w1-muted { opacity: .62; }
.w1-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--w1-line); }
.w1-on { color: var(--w1-on); }
.w1-pill.w1-on { background: color-mix(in srgb, var(--w1-on) 13%, transparent); border-color: color-mix(in srgb, var(--w1-on) 45%, transparent); }
.w1-off { opacity: .75; }
.w1-err { color: var(--w1-err); }
.w1-pill.w1-err { background: color-mix(in srgb, var(--w1-err) 12%, transparent); border-color: color-mix(in srgb, var(--w1-err) 45%, transparent); }
.w1-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--w1-line); background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 600; line-height: 1; cursor: pointer; white-space: nowrap; }
.w1-btn:hover { background: var(--w1-hover); }
.w1-btn:focus-visible, .w1-seg button:focus-visible, .w1-orb:focus-visible { outline: 2px solid var(--w1-vpn); outline-offset: 2px; }
.w1-btn[disabled] { opacity: .55; cursor: default; }
.w1-btn-primary { background: var(--w1-on); border-color: transparent; color: #fff; }
.w1-btn-primary:hover { background: var(--w1-on); filter: brightness(1.08); }
.w1-btn-danger { color: var(--w1-err); border-color: color-mix(in srgb, var(--w1-err) 45%, transparent); }
.w1-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: w1-spin .8s linear infinite; }
@keyframes w1-spin { to { transform: rotate(360deg); } }
.w1-panel { border: 1px solid var(--w1-line); border-radius: var(--w1-r); background: var(--w1-soft); margin-bottom: 16px; overflow: hidden; }
.w1-prow { display: grid; grid-template-columns: 140px 1fr auto; align-items: center; gap: 8px 16px; padding: 14px 18px; border-top: 1px solid var(--w1-line); }
.w1-prow:first-child { border-top: 0; }
.w1-prow > b { font-weight: 600; }
.w1-state { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.w1-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.w1-orbbox { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
.w1-orb { position: relative; width: 132px; height: 132px; border-radius: 50%; border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; flex: none; }
.w1-orb::before, .w1-orb::after { content: ""; position: absolute; border-radius: 50%; border: 1px solid var(--w1-line); }
.w1-orb::before { inset: 0; }
.w1-orb::after { inset: 12px; border-style: dashed; }
.w1-orb .w1-disc { position: absolute; inset: 26px; border-radius: 50%; background: currentColor; display: flex; align-items: center; justify-content: center; }
.w1-orb .w1-disc > span { filter: invert(1); font-weight: 650; font-size: 15px; }
.w1-orb .w1-moon { position: absolute; inset: 0; animation: w1-spin 14s linear infinite; }
.w1-orb .w1-moon::before { content: ""; position: absolute; top: -3px; left: calc(50% - 3px); width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .5; }
.w1-orb:hover .w1-disc { opacity: .9; }
.w1-orb.w1-running, .w1-orb.w1-busy { cursor: default; }
.w1-orb.w1-busy .w1-disc { opacity: .7; }
.w1-orb.w1-running .w1-disc { background: var(--w1-on); }
.w1-orb.w1-running .w1-moon::before { background: var(--w1-on); opacity: 1; }
.w1-orb.w1-running .w1-disc > span { filter: none; color: #fff; }
@media (prefers-reduced-motion: reduce) { .w1-orb .w1-moon, .w1-spin { animation: none; } }
.w1-checklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px 18px; max-width: 100%; }
.w1-checklist label { display: flex; align-items: center; gap: 8px; margin: 0; cursor: pointer; line-height: 1.3; }
.w1-checklist input { margin: 0; flex: none; }
.w1-rules-text { width: 100%; resize: vertical; overflow: auto; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; white-space: pre; tab-size: 4; box-sizing: border-box; }
.w1-rules-msgs { margin: 8px 0 0; padding-left: 18px; }
.w1-rules-msgs .w1-warn { color: var(--w1-warn); }
.w1-rules-msgs .w1-bad { color: var(--w1-err); }
.w1-textmode #cbi-we1ssconnect-rule, .w1-textmode .cbi-map-descr { display: none; }
.w1-act { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--w1-line); white-space: nowrap; }
.w1-act small { font-weight: 400; opacity: .8; }
.w1-act-proxy { background: color-mix(in srgb, var(--w1-on) 12%, transparent); border-color: color-mix(in srgb, var(--w1-on) 40%, transparent); color: var(--w1-on); }
.w1-act-vpn { background: color-mix(in srgb, var(--w1-vpn) 12%, transparent); border-color: color-mix(in srgb, var(--w1-vpn) 40%, transparent); color: var(--w1-vpn); }
.w1-act-block { background: color-mix(in srgb, var(--w1-err) 10%, transparent); border-color: color-mix(in srgb, var(--w1-err) 40%, transparent); color: var(--w1-err); }
.w1-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); border: 1px solid var(--w1-line); border-radius: var(--w1-r); margin-bottom: 12px; }
.w1-stats > div { padding: 14px 18px; border-right: 1px solid var(--w1-line); }
.w1-stats > div:last-child { border-right: 0; }
.w1-stats b { display: block; font-size: 18px; font-weight: 650; }
.w1-stats span { font-size: 12px; opacity: .62; }
.w1-seg { display: inline-flex; border: 1px solid var(--w1-line); border-radius: 10px; overflow: hidden; }
.w1-seg button { border: 0; border-radius: 0; margin: 0; padding: 7px 14px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.w1-seg button.w1-active { background: currentColor; }
.w1-seg button.w1-active span { filter: invert(1); }
.w1-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--w1-line); cursor: pointer; }
.w1-row:first-child { border-top: 0; }
.w1-row:hover { background: var(--w1-hover); }
.w1-row.w1-selected { box-shadow: inset 3px 0 0 currentColor; background: var(--w1-hover); }
.w1-row.w1-disabled { cursor: default; opacity: .5; }
.w1-row .w1-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w1-tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--w1-line); opacity: .8; }
.w1-delay { font-size: 12px; min-width: 64px; text-align: right; }
.w1-good { color: var(--w1-on); } .w1-mid { color: var(--w1-warn); } .w1-bad { color: var(--w1-err); }
.w1-list { border: 1px solid var(--w1-line); border-radius: var(--w1-r); overflow: hidden; margin-bottom: 12px; }
.w1-listhead { display: flex; align-items: center; gap: 10px; padding: 11px 14px; background: var(--w1-soft); flex-wrap: wrap; }
.w1-listhead .w1-name { flex: 1; font-weight: 600; }
.w1-bar { height: 6px; border-radius: 3px; background: var(--w1-line); overflow: hidden; margin-top: 6px; }
.w1-bar > i { display: block; height: 100%; background: currentColor; }
.w1-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.w1-alert { border: 1px solid color-mix(in srgb, var(--w1-warn) 50%, transparent); background: color-mix(in srgb, var(--w1-warn) 10%, transparent); border-radius: 12px; padding: 11px 16px; margin-bottom: 12px; }
.w1-ip { cursor: pointer; }
.w1-check { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--w1-line); }
.w1-check:first-child { border-top: 0; }
.w1-log { max-height: 420px; overflow: auto; font-size: 12px; white-space: pre-wrap; }
@media (max-width: 600px) {
	.w1-prow { grid-template-columns: 1fr; }
	.w1-actions { justify-content: flex-start; }
	.w1-stats > div { border-right: 0; border-top: 1px solid var(--w1-line); }
	.w1-stats > div:first-child { border-top: 0; }
	.w1-orbbox { justify-content: center; text-align: center; }
}
`;

return baseclass.extend({
	status: call('status'),
	service: call('service', ['action']),
	setMode: call('set_mode', ['mode']),
	servers: call('servers'),
	ping: call('ping'),
	select: call('select', ['id']),
	importLinks: call('import', ['text']),
	remove: call('remove', ['id']),
	subAdd: call('sub_add', ['url', 'name']),
	subUpdate: call('sub_update', ['id']),
	subRemove: call('sub_remove', ['id']),
	exitInfo: call('exit_info'),
	speedtest: call('speedtest'),
	diagnostics: call('diagnostics'),
	logs: call('logs', ['lines']),
	updateCheck: call('update_check'),
	update: call('update'),
	leases: rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', expect: { '': {} } }),

	SERVICES: SERVICES,
	PRESETS: PRESETS,

	warning: function(text) {
		for (const [ re, tr ] of WARNINGS) {
			const m = String(text).match(re);
			if (m)
				return tr(m);
		}
		return text;
	},

	style: function() {
		if (!document.getElementById('w1-css'))
			document.head.appendChild(E('style', { id: 'w1-css' }, CSS));
	},

	// The panel's mark: a "W" on a tile in the current text colour.
	mark: function() {
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('viewBox', '0 0 32 32');
		svg.setAttribute('class', 'w1-mark');
		svg.innerHTML = '<rect width="32" height="32" rx="9" fill="currentColor"/>' +
			'<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="filter:invert(1)">' +
			'<polyline points="8.6,10 12.3,22 16,13.4 19.7,22 23.4,10" transform="translate(1.7 1.7)" stroke-opacity=".35"/>' +
			'<polyline points="8.6,10 12.3,22 16,13.4 19.7,22 23.4,10"/></g>';
		return svg;
	},

	// st: the service status, shown as the status line on the right of every page.
	header: function(title, sub, st, serverName) {
		this.style();
		return E('div', { class: 'w1-head' }, [
			this.mark(),
			E('div', { class: 'w1-headtext' }, [ E('div', { class: 'w1-title' }, title), E('div', { class: 'w1-sub' }, sub || '') ]),
			st ? this.statusLine(st, serverName) : ''
		]);
	},

	statusLine: function(st, serverName) {
		const l = state.serviceLabel(st);
		return E('div', { class: 'w1-status', role: 'status' }, [
			E('span', { class: 'w1-dot w1-' + l.kind }), E('span', {}, l.text),
			st.running && serverName ? E('span', { class: 'w1-name' }, serverName) : ''
		]);
	},

	// Disabled with a spinner until fn's promise settles, so a double click sends one command.
	button: function(label, kind, fn) {
		const text = E('span', {}, label);
		const b = E('button', { type: 'button', class: 'w1-btn' + (kind ? ' w1-btn-' + kind : '') }, text);
		b.addEventListener('click', () => {
			if (b.disabled)
				return;
			b.disabled = true;
			const spin = E('i', { class: 'w1-spin', 'aria-hidden': 'true' });
			b.insertBefore(spin, text);
			Promise.resolve().then(fn).catch((e) => this.notify({ error: e.message || String(e) })).finally(() => {
				b.disabled = false;
				spin.remove();
			});
		});
		return b;
	},

	// The podkop-style controls: service state with Start/Stop and Restart, autostart apart.
	serviceBlock: function(st, onChange) {
		const run = (action) => () => this.service(action).then((r) => {
			this.notify(r);
			return onChange(r);
		});
		const acts = state.serviceActions(st);
		const btn = (a, kind) => this.button(state.ACTION_LABELS[a], kind, run(a));
		const l = state.serviceLabel(st);
		return E('div', { class: 'w1-panel' }, [
			E('div', { class: 'w1-prow' }, [
				E('b', {}, _('Service')),
				E('span', { class: 'w1-state' }, [ E('span', { class: 'w1-dot w1-' + l.kind }), l.text ]),
				E('div', { class: 'w1-actions' }, [ btn(acts[0], acts[0] == 'start' ? 'primary' : null), btn(acts[1]) ]),
			]),
			E('div', { class: 'w1-prow' }, [
				E('b', {}, _('Autostart')),
				E('span', { class: 'w1-state' }, [ E('span', { class: 'w1-dot' + (st.autostart ? ' w1-on' : '') }),
					st.autostart ? _('Autostart is on') : _('Autostart is off') ]),
				E('div', { class: 'w1-actions' }, btn(acts[2])),
			]),
		]);
	},

	// The app's connect orb: a disc in still rings, green with an orbiting moon while running.
	orb: function(st, onStart) {
		const running = !!st.running;
		const label = running ? state.serviceLabel(st).text : state.ACTION_LABELS.start;
		// Running, it is a picture, not a disabled button: themes fade disabled buttons.
		if (running)
			return E('div', { class: 'w1-orb w1-running', role: 'img', 'aria-label': label },
				[ E('span', { class: 'w1-moon' }), E('span', { class: 'w1-disc' }, E('span', {}, label)) ]);
		const o = E('button', { type: 'button', class: 'w1-orb', 'aria-label': label }, E('span', { class: 'w1-disc' }, E('span', {}, label)));
		o.addEventListener('click', () => {
			if (o.classList.contains('w1-busy'))
				return;
			o.classList.add('w1-busy');
			this.service('start').then((r) => { this.notify(r); return onStart(r); }).finally(() => o.classList.remove('w1-busy'));
		});
		return o;
	},

	card: function(title, body) {
		return E('div', { class: 'w1-card' }, [ E('h4', {}, title), body ]);
	},

	// 185.**.**.12, like the other clients; a click shows the whole address.
	maskIp: function(ip) {
		if (!ip)
			return '';
		if (ip.indexOf(':') >= 0) {
			const p = ip.split(':');
			return p.length > 3 ? p[0] + ':' + p[1] + ':…:' + p[p.length - 1] : ip;
		}
		const p = ip.split('.');
		return p.length == 4 ? p[0] + '.**.**.' + p[3] : ip;
	},

	flag: function(cc) {
		if (!cc || cc.length != 2)
			return '';
		return String.fromCodePoint.apply(null, cc.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)));
	},

	delay: function(ms) {
		if (ms == null)
			return E('span', { class: 'w1-delay w1-muted' }, '—');
		if (ms < 0)
			return E('span', { class: 'w1-delay w1-bad' }, _('no answer'));
		return E('span', { class: 'w1-delay ' + (ms < 300 ? 'w1-good' : ms < 800 ? 'w1-mid' : 'w1-bad') }, ms + ' ' + _('ms'));
	},

	bytes: function(n) {
		if (n == null)
			return '—';
		const u = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
		let i = 0;
		n = +n;
		while (n >= 1024 && i < u.length - 1) {
			n /= 1024;
			i++;
		}
		return (i ? n.toFixed(n < 10 ? 2 : 1) : n) + ' ' + u[i];
	},

	// Import reasons come from the backend in English; known ones are shown translated.
	reason: function(text) {
		let m;
		if (!text)
			return '';
		if ((m = text.match(/^(\S+) transport is not supported by sing-box$/)))
			return _('%s transport is not supported by sing-box').format(m[1]);
		if ((m = text.match(/^shadowsocks plugin (\S+) is not supported by sing-box$/)))
			return _('Shadowsocks plugin %s is not supported by sing-box').format(m[1]);
		if ((m = text.match(/^missing (.+)$/)))
			return _('Missing: %s').format(m[1]);
		if ((m = text.match(/^unknown link type (\S+)$/)))
			return _('Unknown link type: %s').format(m[1]);
		return text;
	},

	// A release newer than the running one; dev builds (0.x from CI) never offer one.
	updateAvailable: function(u) {
		if (!u || !u.latest || !u.current || /^0\./.test(u.current))
			return false;
		const a = u.latest.split('.').map(Number), b = u.current.split('.').map(Number);
		for (let i = 0; i < 3; i++)
			if ((a[i] || 0) != (b[i] || 0))
				return (a[i] || 0) > (b[i] || 0);
		return false;
	},

	date: function(unix) {
		return unix ? new Date(unix * 1000).toLocaleDateString() : '';
	},

	notify: function(res, okText) {
		if (res && (res.error || res.ok === false))
			ui.addNotification(null, E('p', res.error || _('Failed')), 'danger');
		else if (okText)
			ui.addNotification(null, E('p', okText), 'info');
		return res;
	},
});
