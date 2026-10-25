'use strict';
'require view';
'require dom';
'require ui';
'require we1ssconnect.common as w1';

const CHECK_NAMES = {
	'sing-box': _('sing-box installed'), config: _('Config accepted by sing-box'), service: _('sing-box running'),
	nftables: _('Interception rules loaded'), 'tproxy module': _('TPROXY kernel module'), 'policy routing': _('Policy routing'),
	'dnsmasq → sing-box': _('dnsmasq forwards to sing-box'), 'DNS through sing-box': _('DNS answers through sing-box'),
	tunnel: _('Request through the tunnel'),
};

return view.extend({
	load: function() {
		return Promise.all([ w1.diagnostics(), w1.logs(200), w1.status() ]);
	},

	draw: function(diag, log, st) {
		const checks = (diag.checks || []).map((c) => E('div', { class: 'w1-check' }, [
			E('span', { class: c.ok ? 'w1-good' : 'w1-bad', style: 'width:18px' }, c.ok ? '✓' : '✗'),
			E('span', { style: 'flex:1' }, CHECK_NAMES[c.name] || c.name),
			E('span', { class: 'w1-muted', style: 'font-size:12px' }, c.detail || ''),
		]));
		dom.content(this.box, [
			w1.header(_('Diagnostics'), [ 'We1ssConnect ', st.version || '', ' · ', st.singbox || '' ]),
			(diag.warnings || []).length ? E('div', { class: 'w1-alert' }, diag.warnings.map((x) => E('div', {}, x))) : '',
			E('div', { class: 'w1-toolbar' }, [
				E('button', { class: 'cbi-button cbi-button-action', click: ui.createHandlerFn(this, 'reload') }, _('Run again')),
				E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, 'handleUpdate') }, _('Check for updates')),
				this.updateBox,
			]),
			E('div', { class: 'w1-grid' }, [ w1.card(_('Checks'), E('div', {}, checks)) ]),
			w1.card(_('sing-box log'), E('pre', { class: 'w1-log' }, log.log || _('The log is empty.'))),
		]);
	},

	reload: function() {
		return this.load().then((d) => this.draw(d[0] || {}, d[1] || {}, d[2] || {}));
	},

	handleUpdate: function() {
		return w1.updateCheck().then((r) => {
			if (r.error)
				return dom.content(this.updateBox, E('span', { class: 'w1-bad' }, r.error));
			if (!w1.updateAvailable(r))
				return dom.content(this.updateBox, E('span', { class: 'w1-good' }, _('Up to date')));
			dom.content(this.updateBox, [ _('Version %s is available.').format(r.latest), ' ',
				E('button', { class: 'cbi-button cbi-button-positive', click: ui.createHandlerFn(this, () => w1.update().then(() => w1.notify({}, _('Updating in the background; reload the page in a minute.')))) }, _('Update')) ]);
		});
	},

	render: function(data) {
		this.box = E('div', { class: 'w1-wrap' });
		this.updateBox = E('span', { style: 'align-self:center' });
		this.draw(data[0] || {}, data[1] || {}, data[2] || {});
		return this.box;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
});
