'use strict';
'require view';
'require dom';
'require poll';
'require ui';
'require we1ssconnect.common as w1';

return view.extend({
	load: function() {
		return Promise.all([ w1.status(), w1.servers(), w1.updateCheck().catch(() => ({})) ]);
	},

	serverName: function(tag) {
		if (!tag)
			return null;
		const id = tag.replace(/^s-/, '');
		const s = (this.list.servers || []).find((x) => x.id == id);
		return s ? s : { name: tag };
	},

	renderState: function(st) {
		const box = this.box;
		const running = st.running;
		const pill = st.error ? E('span', { class: 'w1-pill w1-err' }, _('Error'))
			: running ? E('span', { class: 'w1-pill w1-on' }, _('Connected'))
			: E('span', { class: 'w1-pill w1-off' }, st.enabled ? _('Starting…') : _('Off'));
		const now = this.serverName(st.now);

		const toggle = E('button', {
			class: 'cbi-button ' + (st.enabled ? 'cbi-button-reset' : 'cbi-button-positive'),
			click: ui.createHandlerFn(this, () => w1.setEnabled(!st.enabled).then((r) => this.renderState(r)))
		}, st.enabled ? _('Disconnect') : _('Connect'));

		const seg = E('div', { class: 'w1-seg' }, [ [ 'selective', _('By lists') ], [ 'global', _('All traffic') ] ].map((m) =>
			E('button', {
				class: st.mode == m[0] ? 'w1-active' : '',
				click: ui.createHandlerFn(this, () => w1.setMode(m[0]).then((r) => w1.notify(r)).then(() => w1.status()).then((r) => this.renderState(r)))
			}, E('span', {}, m[1]))));

		const server = E('div', {}, [
			E('div', { class: 'w1-big' }, now ? now.name : (st.servers ? _('Auto') : _('No servers yet'))),
			E('div', { class: 'w1-muted', style: 'margin-top:4px' }, [
				st.auto ? E('span', { class: 'w1-tag' }, _('Auto · lowest delay')) : (st.selected != 'auto' ? E('span', { class: 'w1-tag' }, _('Pinned')) : ''),
				' ', now && now.delay != null ? w1.delay(now.delay) : ''
			]),
			E('div', { style: 'margin-top:10px' }, E('a', { href: L.url('admin/services/we1ssconnect/servers') }, _('Choose a server →')))
		]);

		const t = st.traffic || {};
		const stats = E('div', { class: 'w1-stats' }, [
			E('div', {}, [ E('b', {}, w1.bytes(t.down)), E('span', {}, _('Downloaded')) ]),
			E('div', {}, [ E('b', {}, w1.bytes(t.up)), E('span', {}, _('Uploaded')) ]),
			E('div', {}, [ E('b', {}, t.connections != null ? String(t.connections) : '—'), E('span', {}, _('Connections')) ]),
			E('div', {}, [ E('b', {}, String(st.servers || 0)), E('span', {}, _('Servers')) ]),
		]);

		const warnings = (st.warnings || []).concat(st.error ? [ st.error ] : []);
		dom.content(box, [
			w1.header('We1ssConnect', [ _('Version'), ' ', st.version, ' · ', st.singbox || '' ], pill),
			this.update && this.update.latest && this.update.latest != st.version && this.update.current != '0.0.0'
				? E('div', { class: 'w1-alert' }, [ _('Version %s is available.').format(this.update.latest), ' ',
					E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(this, () => w1.update().then(() => w1.notify({}, _('Updating in the background; reload the page in a minute.')))) }, _('Update')) ])
				: '',
			warnings.length ? E('div', { class: 'w1-alert' }, warnings.map((x) => E('div', {}, x))) : '',
			E('div', { class: 'w1-grid' }, [
				w1.card(_('Tunnel'), E('div', {}, [ E('div', { style: 'margin-bottom:10px' }, toggle), seg,
					E('div', { class: 'w1-muted', style: 'margin-top:8px;font-size:12px' },
						st.mode == 'global' ? _('Everything goes through the tunnel except direct rules and bypassed devices.')
							: _('Only sites and services from routing rules go through the tunnel.')) ])),
				w1.card(_('Server'), server),
				w1.card(_('Exit IP'), this.ipBox),
			]),
			stats,
			E('div', { class: 'w1-toolbar' }, [
				E('button', { class: 'cbi-button', disabled: !running || null, click: ui.createHandlerFn(this, 'handleSpeed') }, _('Speed test')),
				this.speedBox,
			]),
		]);
		if (running && !this.ipLoaded) {
			this.ipLoaded = true;
			this.loadIp();
		}
		else if (!running) {
			this.ipLoaded = false;
			dom.content(this.ipBox, E('div', { class: 'w1-muted' }, _('Connect to see the exit IP.')));
		}
	},

	loadIp: function() {
		dom.content(this.ipBox, E('div', { class: 'w1-muted' }, _('Checking…')));
		return w1.exitInfo().then((r) => {
			if (r.error)
				return dom.content(this.ipBox, E('div', { class: 'w1-muted' }, _('No answer through the tunnel.')));
			const ip = E('span', { class: 'w1-big w1-ip', title: _('Click to show the whole address') }, w1.maskIp(r.ip));
			ip.addEventListener('click', () => { ip.textContent = ip.textContent == r.ip ? w1.maskIp(r.ip) : r.ip; });
			dom.content(this.ipBox, [
				E('div', {}, [ w1.flag(r.country_code), ' ', ip ]),
				E('div', { class: 'w1-muted', style: 'margin-top:4px' }, [ r.country, r.city ].filter((x) => x).join(', ')),
				E('div', { class: 'w1-muted' }, r.isp || ''),
				E('div', { style: 'margin-top:8px' }, E('a', { href: '#', click: (ev) => { ev.preventDefault(); this.loadIp(); } }, _('Refresh'))),
			]);
		});
	},

	handleSpeed: function() {
		dom.content(this.speedBox, E('span', { class: 'w1-muted' }, _('Measuring for up to 15 seconds…')));
		return w1.speedtest().then((r) => dom.content(this.speedBox,
			r.error ? E('span', { class: 'w1-bad' }, r.error) : E('b', {}, _('%s Mbit/s').format(r.mbps))));
	},

	render: function(data) {
		this.list = data[1] || {};
		this.update = data[2] || {};
		this.box = E('div', { class: 'w1-wrap' });
		this.ipBox = E('div');
		this.speedBox = E('span', { style: 'align-self:center' });
		this.renderState(data[0] || {});
		poll.add(() => Promise.all([ w1.status(), w1.servers() ]).then((r) => {
			this.list = r[1] || this.list;
			this.renderState(r[0] || {});
		}), 5);
		return this.box;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
});
