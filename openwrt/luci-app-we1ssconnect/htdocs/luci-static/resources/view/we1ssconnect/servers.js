'use strict';
'require view';
'require dom';
'require ui';
'require we1ssconnect.common as w1';

return view.extend({
	load: function() {
		return w1.servers();
	},

	refresh: function() {
		return w1.servers().then((d) => { this.data = d; this.draw(); });
	},

	pick: function(id) {
		return w1.select(id).then((r) => {
			w1.notify(r);
			this.data.selected = id;
			this.draw();
			return this.refresh();
		});
	},

	row: function(s) {
		const d = this.data;
		const selected = d.selected == s.id;
		if (!s.ok)
			return E('div', { class: 'w1-row w1-disabled', title: s.reason }, [
				E('span', { class: 'w1-name' }, s.name), E('span', { class: 'w1-tag' }, _('not supported')),
				E('span', { class: 'w1-muted', style: 'font-size:12px' }, s.reason)
			]);
		const delay = this.delays[s.id] != null ? this.delays[s.id] : s.delay;
		const now = d.now == 's-' + s.id;
		return E('div', { class: 'w1-row' + (selected ? ' w1-selected' : ''), click: ui.createHandlerFn(this, 'pick', s.id) }, [
			E('span', { class: 'w1-name' }, [ s.name, now ? E('span', { class: 'w1-muted' }, ' · ' + _('in use')) : '' ]),
			E('span', { class: 'w1-tag' }, s.type),
			E('span', { class: 'w1-muted', style: 'font-size:12px' }, s.address),
			w1.delay(delay),
			s.source == 'manual' ? E('button', {
				class: 'cbi-button cbi-button-remove', title: _('Remove'),
				click: ui.createHandlerFn(this, (ev) => { ev.stopPropagation(); return w1.remove(s.id).then(() => this.refresh()); })
			}, '×') : ''
		]);
	},

	subHead: function(id, info) {
		const u = info.userinfo;
		let traffic = '';
		if (u) {
			const used = (u.upload || 0) + (u.download || 0);
			traffic = E('div', { style: 'min-width:220px' }, [
				E('div', { class: 'w1-muted', style: 'font-size:12px' }, u.total
					? _('%s of %s').format(w1.bytes(used), w1.bytes(u.total)) : _('%s used').format(w1.bytes(used))),
				u.total ? E('div', { class: 'w1-bar' }, E('i', { style: 'width:' + Math.min(100, Math.round(used * 100 / u.total)) + '%' })) : '',
			]);
		}
		return E('div', { class: 'w1-listhead' }, [
			E('span', { class: 'w1-name' }, info.title || info.name || id),
			u && u.expire ? E('span', { class: 'w1-muted', style: 'font-size:12px' }, _('until %s').format(w1.date(u.expire))) : '',
			info.error ? E('span', { class: 'w1-pill w1-err' }, info.error) : '',
			info.updated ? E('span', { class: 'w1-muted', style: 'font-size:12px' }, _('updated %s').format(new Date(info.updated * 1000).toLocaleString())) : '',
			traffic,
			info.page ? E('a', { href: info.page, target: '_blank', rel: 'noreferrer' }, _('Panel page')) : '',
			E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, () => w1.subUpdate(id).then((r) => w1.notify(r.results && r.results[id])).then(() => this.refresh())) }, _('Refresh')),
			E('button', { class: 'cbi-button cbi-button-remove', click: ui.createHandlerFn(this, () => {
				if (confirm(_('Remove the subscription and its servers?')))
					return w1.subRemove(id).then(() => this.refresh());
			}) }, _('Remove')),
		]);
	},

	draw: function() {
		const d = this.data;
		const auto = E('div', { class: 'w1-list' }, E('div', {
			class: 'w1-row' + (d.selected == 'auto' ? ' w1-selected' : ''), click: ui.createHandlerFn(this, 'pick', 'auto')
		}, [
			E('span', { class: 'w1-name' }, [ E('b', {}, _('Auto')), ' ', E('span', { class: 'w1-muted' }, _('lowest delay, switches when a server stops answering')) ]),
		]));

		const bySource = {};
		(d.servers || []).forEach((s) => { (bySource[s.source] = bySource[s.source] || []).push(s); });
		const blocks = [];
		if (bySource.manual)
			blocks.push(E('div', { class: 'w1-list' }, [ E('div', { class: 'w1-listhead' }, E('span', { class: 'w1-name' }, _('My keys'))) ].concat(bySource.manual.map((s) => this.row(s)))));
		Object.keys(d.subscriptions || {}).forEach((id) => {
			blocks.push(E('div', { class: 'w1-list' }, [ this.subHead(id, d.subscriptions[id]) ].concat((bySource[id] || []).map((s) => this.row(s)))));
		});

		dom.content(this.box, [
			w1.header(_('Servers'), _('Tap a server to pin it, or choose Auto. Switching does not restart the tunnel.')),
			E('div', { class: 'w1-toolbar' }, [
				E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(this, 'handlePing') }, _('Test delay')),
				E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, 'handleImport') }, _('Add keys')),
				E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, 'handleSubscription') }, _('Add subscription')),
				E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, () => w1.subUpdate('all').then(() => this.refresh())) }, _('Refresh subscriptions')),
			]),
			auto,
			...(blocks.length ? blocks : [ E('div', { class: 'w1-card w1-muted' }, _('No servers yet: add a We1ssBoard subscription or paste keys.')) ]),
		]);
	},

	handlePing: function() {
		return w1.ping().then((r) => {
			if (r.error)
				return w1.notify(r);
			this.delays = r.delays || {};
			this.draw();
		});
	},

	handleImport: function() {
		const ta = E('textarea', { class: 'cbi-input-textarea', rows: 8, style: 'width:100%', placeholder: 'vless://…\nhysteria2://…' });
		ui.showModal(_('Add keys'), [
			E('p', {}, _('One share link per line: VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, WireGuard, SOCKS, AnyTLS.')),
			ta,
			E('div', { class: 'right' }, [
				E('button', { class: 'cbi-button', click: ui.hideModal }, _('Cancel')), ' ',
				E('button', { class: 'cbi-button cbi-button-positive', click: ui.createHandlerFn(this, () => w1.importLinks(ta.value).then((r) => {
					ui.hideModal();
					const skipped = (r.skipped || []).map((x) => E('li', {}, x.name + ': ' + x.reason));
					ui.addNotification(null, [ E('p', {}, _('Added: %d').format(r.added || 0)), skipped.length ? E('ul', {}, skipped) : '' ], skipped.length ? 'warning' : 'info');
					return this.refresh();
				})) }, _('Add'))
			])
		]);
	},

	handleSubscription: function() {
		const url = E('input', { class: 'cbi-input-text', style: 'width:100%', placeholder: 'https://panel.example.com/sub/…' });
		const name = E('input', { class: 'cbi-input-text', style: 'width:100%', placeholder: _('Name (optional)') });
		ui.showModal(_('Add subscription'), [
			E('p', {}, _('A We1ssBoard subscription link or any other one with share links (plain or base64).')),
			url, E('div', { style: 'height:8px' }), name,
			E('div', { class: 'right', style: 'margin-top:12px' }, [
				E('button', { class: 'cbi-button', click: ui.hideModal }, _('Cancel')), ' ',
				E('button', { class: 'cbi-button cbi-button-positive', click: ui.createHandlerFn(this, () => w1.subAdd(url.value.trim(), name.value.trim()).then((r) => {
					ui.hideModal();
					const res = (r.results || {})[r.id] || {};
					w1.notify(res, res.error ? null : _('Added: %d').format(res.added || 0));
					return this.refresh();
				})) }, _('Add'))
			])
		]);
	},

	render: function(data) {
		this.data = data || {};
		this.delays = {};
		this.box = E('div', { class: 'w1-wrap' });
		this.draw();
		return this.box;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
});
