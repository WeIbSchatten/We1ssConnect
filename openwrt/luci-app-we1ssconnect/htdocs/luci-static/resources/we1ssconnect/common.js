'use strict';
'require baseclass';
'require rpc';
'require ui';

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

const CSS = `
.w1-wrap { max-width: 1100px; }
.w1-head { display: flex; align-items: center; gap: 12px; margin: 4px 0 16px; }
.w1-mark { width: 36px; height: 36px; flex: none; }
.w1-title { font-size: 20px; font-weight: 600; line-height: 1.2; }
.w1-sub { opacity: .65; font-size: 12px; }
.w1-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 12px; }
.w1-card { border: 1px solid rgba(128,128,128,.28); border-radius: 12px; padding: 14px 16px; background: rgba(128,128,128,.04); }
.w1-card h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; opacity: .65; font-weight: 600; }
.w1-big { font-size: 18px; font-weight: 600; word-break: break-word; }
.w1-muted { opacity: .65; }
.w1-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid rgba(128,128,128,.35); }
.w1-on { background: rgba(31,122,69,.14); border-color: rgba(31,122,69,.45); color: #1f9a55; }
.w1-off { opacity: .75; }
.w1-err { background: rgba(179,54,47,.12); border-color: rgba(179,54,47,.45); color: #c9443c; }
.w1-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); border: 1px solid rgba(128,128,128,.28); border-radius: 12px; margin-bottom: 12px; }
.w1-stats > div { padding: 12px 16px; border-right: 1px solid rgba(128,128,128,.18); }
.w1-stats > div:last-child { border-right: 0; }
.w1-stats b { display: block; font-size: 17px; }
.w1-stats span { font-size: 12px; opacity: .65; }
.w1-seg { display: inline-flex; border: 1px solid rgba(128,128,128,.35); border-radius: 10px; overflow: hidden; }
.w1-seg button { border: 0; border-radius: 0; margin: 0; padding: 6px 14px; background: transparent; color: inherit; cursor: pointer; }
.w1-seg button.w1-active { background: currentColor; }
.w1-seg button.w1-active span { filter: invert(1); }
.w1-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-top: 1px solid rgba(128,128,128,.18); cursor: pointer; }
.w1-row:first-child { border-top: 0; }
.w1-row:hover { background: rgba(128,128,128,.07); }
.w1-row.w1-selected { box-shadow: inset 3px 0 0 currentColor; background: rgba(128,128,128,.09); }
.w1-row.w1-disabled { cursor: default; opacity: .5; }
.w1-row .w1-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w1-tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(128,128,128,.35); opacity: .8; }
.w1-delay { font-variant-numeric: tabular-nums; font-size: 12px; min-width: 64px; text-align: right; }
.w1-good { color: #1f9a55; } .w1-mid { color: #b98a17; } .w1-bad { color: #c9443c; }
.w1-list { border: 1px solid rgba(128,128,128,.28); border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.w1-listhead { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(128,128,128,.06); flex-wrap: wrap; }
.w1-listhead .w1-name { flex: 1; font-weight: 600; }
.w1-bar { height: 6px; border-radius: 3px; background: rgba(128,128,128,.2); overflow: hidden; margin-top: 6px; }
.w1-bar > i { display: block; height: 100%; background: currentColor; }
.w1-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.w1-alert { border: 1px solid rgba(185,138,23,.5); background: rgba(185,138,23,.1); border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
.w1-ip { cursor: pointer; font-variant-numeric: tabular-nums; }
.w1-check { display: flex; gap: 10px; padding: 7px 0; border-top: 1px solid rgba(128,128,128,.18); }
.w1-check:first-child { border-top: 0; }
.w1-log { max-height: 420px; overflow: auto; font-size: 12px; white-space: pre-wrap; }
`;

return baseclass.extend({
	status: call('status'),
	setEnabled: call('set_enabled', ['enabled']),
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

	header: function(title, sub, pill) {
		this.style();
		return E('div', { class: 'w1-head' }, [
			this.mark(),
			E('div', { style: 'flex:1' }, [ E('div', { class: 'w1-title' }, title), E('div', { class: 'w1-sub' }, sub || '') ]),
			pill || ''
		]);
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
