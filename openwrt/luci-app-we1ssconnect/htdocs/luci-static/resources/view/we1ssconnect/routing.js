'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require dom';
'require tools.widgets as widgets';
'require we1ssconnect.common as w1';
'require we1ssconnect.rules as rules';

// Domains and subnets are text in LuCI, but may be uci lists (uci add_list, older configs).
function entries(sid, option) {
	return [].concat(uci.get('we1ssconnect', sid, option) || []).join('\n').split(/\s+/).filter((x) => x);
}

// What a rule matches, in words; also the row title of rules without a name.
function summary(sid) {
	const parts = [];
	[].concat(uci.get('we1ssconnect', sid, 'protocol') || []).forEach((k) => parts.push(k));
	[].concat(uci.get('we1ssconnect', sid, 'service') || []).forEach((k) => parts.push(w1.SERVICES[k] || k));
	[].concat(uci.get('we1ssconnect', sid, 'preset') || []).forEach((k) => parts.push(w1.PRESETS[k] || k));
	[].concat(uci.get('we1ssconnect', sid, 'category') || []).forEach((k) => parts.push(k));
	const dom = entries(sid, 'domain');
	if (dom.length)
		parts.push(dom.length > 2 ? _('%d domains').format(dom.length) : dom.join(', '));
	const net = entries(sid, 'subnet');
	if (net.length)
		parts.push(_('%d subnets').format(net.length));
	const rl = [].concat(uci.get('we1ssconnect', sid, 'remote_list') || []);
	if (rl.length)
		parts.push(_('%d remote lists').format(rl.length));
	return parts.join(' · ');
}

// A multiple choice as a wrapping grid of checkboxes. The stock dropdown is drawn by the theme,
// and some (proton2025) show the chosen items as unticked switches in one overflowing row.
const ChecklistValue = form.MultiValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		const chosen = L.toArray(cfgvalue != null ? cfgvalue : this.default);
		return E('div', { class: 'w1-checklist', id: this.cbid(section_id) }, this.keylist.map((k, i) =>
			E('label', {}, [ E('input', { type: 'checkbox', value: k, checked: chosen.indexOf(k) >= 0 ? '' : null }), this.vallist[i] ])));
	},
	formvalue: function(section_id) {
		const box = this.map.findElement('id', this.cbid(section_id));
		return box ? Array.prototype.map.call(box.querySelectorAll('input:checked'), (i) => i.value) : null;
	},
});

const ACTIONS = {
	proxy: _('Through the tunnel'),
	vpn: _('Through a router interface'),
	direct: _('Directly'),
	block: _('Block'),
};

return view.extend({
	load: function() {
		return Promise.all([ w1.servers(), uci.load('we1ssconnect') ]);
	},

	render: function(data) {
		const list = data[0] || {};
		const servers = (list.servers || []).filter((s) => s.ok);
		let m, s, o;

		m = new form.Map('we1ssconnect', null,
			_('Rules are checked from top to bottom; the first match wins. Drag rows to change the order.'));
		w1.style();

		s = m.section(form.GridSection, 'rule', _('Routing rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('Routing rule');
		s.sectiontitle = (sid) => uci.get('we1ssconnect', sid, 'name') || summary(sid) || _('Rule');

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.modalonly = true;

		o = s.option(form.ListValue, 'action', _('Where to send'));
		for (const k in ACTIONS)
			o.value(k, ACTIONS[k]);
		o.default = 'proxy';
		o.textvalue = (sid) => ACTIONS[uci.get('we1ssconnect', sid, 'action') || 'proxy'];

		o = s.option(form.ListValue, 'target', _('Server'));
		o.value('auto', _('Auto (lowest delay)'));
		uci.sections('we1ssconnect', 'group').forEach((g) => o.value('group:' + g['.name'], _('Group: %s').format(g.name || g['.name'])));
		servers.forEach((x) => o.value('server:' + x.id, x.name));
		o.default = 'auto';
		o.depends('action', 'proxy');
		o.textvalue = function(sid) {
			if ((uci.get('we1ssconnect', sid, 'action') || 'proxy') != 'proxy')
				return '—';
			const v = this.cfgvalue(sid) || 'auto';
			return this.keylist.indexOf(v) >= 0 ? this.vallist[this.keylist.indexOf(v)] : _('missing: %s').format(v);
		};

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'),
			_('A VPN already set up on the router: WireGuard, AmneziaWG, OpenVPN…'));
		o.noaliases = true;
		o.nocreate = true;
		o.depends('action', 'vpn');
		o.textvalue = (sid) => uci.get('we1ssconnect', sid, 'action') == 'vpn' ? (uci.get('we1ssconnect', sid, 'interface') || '—') : '—';

		o = s.option(ChecklistValue, 'service', _('Services'),
			_('Community lists of itdoginfo/allow-domains, refreshed automatically.'));
		for (const k in w1.SERVICES)
			o.value(k, w1.SERVICES[k]);
		o.modalonly = true;

		o = s.option(ChecklistValue, 'preset', _('Presets'));
		for (const k in w1.PRESETS)
			o.value(k, w1.PRESETS[k]);
		o.modalonly = true;

		o = s.option(ChecklistValue, 'protocol', _('Protocols'),
			_('Traffic sing-box recognizes as this protocol, such as bittorrent.'));
		rules.PROTOCOLS.forEach((p) => o.value(p, p));
		o.modalonly = true;

		o = s.option(form.DynamicList, 'category', _('Categories'),
			_('geosite:… and geoip:… categories of the rule files, as in Xray and v2rayN: geosite:ru-blocked, geosite:youtube, geoip:telegram. The phone and computer apps understand the same names.'));
		[ 'geosite:ru-blocked', 'geosite:ru-blocked-all', 'geosite:ru-available-only-inside', 'geosite:youtube', 'geosite:telegram',
			'geosite:discord', 'geosite:category-ads-all', 'geosite:category-ru', 'geoip:ru', 'geoip:telegram', 'geoip:ru-blocked',
			'geoip:cloudflare' ].forEach((c) => o.value(c, c));
		o.validate = (sid, v) => !v || /^geo(site|ip):[a-z0-9][a-z0-9._!-]*$/i.test(v) || _('Use geosite:name or geoip:name');
		o.modalonly = true;

		o = s.option(form.TextValue, 'domain', _('Domains'),
			_('One per line; a domain also covers its subdomains.'));
		o.rows = 5;
		o.modalonly = true;
		o.cfgvalue = (sid) => entries(sid, 'domain').join('\n');

		o = s.option(form.TextValue, 'subnet', _('IP addresses and subnets'), _('One per line, such as 149.154.160.0/20.'));
		o.rows = 4;
		o.modalonly = true;
		o.cfgvalue = (sid) => entries(sid, 'subnet').join('\n');

		o = s.option(form.DynamicList, 'remote_list', _('Remote lists'),
			_('URLs of sing-box rule-sets (.srs, .json) or plain lists of domains and subnets.'));
		o.modalonly = true;

		o = s.option(form.DummyValue, '_what', _('Matches'));
		o.textvalue = (sid) => summary(sid) || '—';
		// The rule editor shows cfgvalue, not textvalue; without it the field read "null".
		o.cfgvalue = (sid) => summary(sid) || '—';

		s = m.section(form.GridSection, 'group', _('Server groups'),
			_('A group balances its servers by lowest delay. Point a rule at a group to keep, say, one country for one service.'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;
		s.modaltitle = _('Server group');

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;

		o = s.option(ChecklistValue, 'subscription', _('Subscriptions'));
		Object.keys(list.subscriptions || {}).forEach((id) => {
			const info = list.subscriptions[id];
			o.value(id, info.title || info.name || id);
		});
		o.value('manual', _('My keys'));

		o = s.option(ChecklistValue, 'server', _('Servers'));
		servers.forEach((x) => o.value(x.id, x.name));
		o.modalonly = true;

		o = s.option(form.Value, 'filter', _('Name filter'), _('Regular expression, such as finland|helsinki.'));

		this.map = m;
		this.ctx = {
			groups: uci.sections('we1ssconnect', 'group').map((g) => ({ sid: g['.name'], name: g.name || g['.name'] })),
			servers: servers.map((x) => ({ id: x.id, name: x.name })),
			services: Object.keys(w1.SERVICES),
			presets: Object.keys(w1.PRESETS),
		};
		this.categories = {};
		this.textarea = E('textarea', { class: 'w1-rules-text', spellcheck: 'false', input: () => this.check() });
		this.msgs = E('ul', { class: 'w1-rules-msgs' });
		this.textBox = E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Routing rules')),
			E('div', { class: 'cbi-section-descr' }, _('One rule per line, checked from top to bottom: condition(value)->action. Conditions: domain, geoip, ip, service, preset, list, protocol. Actions: direct, proxy, proxy(server or group), block, vpn(interface). A # line names the rules under it; ! at the start turns a rule off; default: direct or default: proxy sets the mode.')),
			this.textarea, this.msgs,
		]);
		this.buttons = {
			form: E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, 'show', 'form', false) }, _('As a form')),
			text: E('button', { class: 'cbi-button', click: ui.createHandlerFn(this, 'show', 'text', false) }, _('As text')),
		};
		return m.render().then((node) => {
			this.root = E('div', {}, [ E('div', { class: 'w1-views' }, [ this.buttons.form, this.buttons.text ]), this.textBox, node ]);
			let saved = null;
			try { saved = localStorage.getItem('we1ssconnect.routing.view'); } catch (e) {}
			return this.show(saved == 'text' ? 'text' : 'form', true).then(() => this.root);
		});
	},

	// The rule sections stay the storage; the text is printed from them and parsed back.
	show: function(mode, initial) {
		let ready;
		if (mode == 'text')
			ready = (initial ? Promise.resolve() : this.map.parse()).then(() => {
				this.textarea.value = this.text();
				this.check();
				return true;
			});
		else
			ready = this.mode == 'text' ? this.applyText() : Promise.resolve(true);
		return ready.then((ok) => {
			if (!ok)
				return;
			this.mode = mode;
			try { localStorage.setItem('we1ssconnect.routing.view', mode); } catch (e) {}
			this.root.classList.toggle('w1-textmode', mode == 'text');
			this.textBox.style.display = mode == 'text' ? '' : 'none';
			for (const k in this.buttons)
				this.buttons[k].classList.toggle('cbi-button-action', k == mode);
		}).catch((e) => ui.addNotification(null, E('p', {}, e.message), 'danger'));
	},

	text: function() {
		const sections = uci.sections('we1ssconnect', 'rule').map((s) => {
			const r = { enabled: s.enabled != '0', name: s.name || '', action: s.action || 'proxy', target: s.target || '', interface: s.interface || '' };
			rules.LISTS.forEach((k) => r[k] = s[k]);
			return r;
		});
		return rules.serialize(uci.get('we1ssconnect', 'main', 'mode') == 'global' ? 'global' : 'selective', sections, this.ctx);
	},

	check: function() {
		const p = rules.parse(this.textarea.value, Object.assign({ mode: uci.get('we1ssconnect', 'main', 'mode') }, this.ctx));
		const items = p.errors.map((e) => E('li', { class: 'w1-bad' }, _('Line %d: %s').format(e.line, e.msg)))
			.concat(p.warnings.map((w) => E('li', { class: 'w1-warn' }, _('Line %d: %s').format(w.line, w.msg))));
		p.categories.forEach((c) => {
			const state = this.categories[c.category];
			if (state == 'missing')
				items.push(E('li', { class: 'w1-warn' }, _('Line %d: the rule files have no category %s').format(c.line, c.category)));
			else if (state == null)
				this.lookUp(c.category);
		});
		dom.content(this.msgs, items);
		return p;
	},

	// Only a 404 counts as missing: an offline browser must not flag every category.
	lookUp: function(category) {
		this.categories[category] = 'pending';
		fetch(rules.categoryUrl(category), { method: 'HEAD' })
			.then((r) => this.categories[category] = r.status == 404 ? 'missing' : 'ok')
			.catch(() => this.categories[category] = 'ok')
			.then(() => this.mode == 'text' && this.check());
	},

	applyText: function() {
		const p = this.check();
		if (p.errors.length) {
			ui.addNotification(null, E('p', {}, _('Fix the lines marked in the rule text first.')), 'danger');
			return Promise.resolve(false);
		}
		uci.sections('we1ssconnect', 'rule').forEach((s) => uci.remove('we1ssconnect', s['.name']));
		p.rules.forEach((r) => {
			const sid = uci.add('we1ssconnect', 'rule');
			const set = (k, v) => uci.set('we1ssconnect', sid, k, v);
			if (r.name)
				set('name', r.name);
			if (!r.enabled)
				set('enabled', '0');
			set('action', r.action);
			if (r.action == 'proxy')
				set('target', r.target);
			if (r.action == 'vpn')
				set('interface', r.interface);
			[ 'domain', 'subnet' ].forEach((k) => r[k].length && set(k, r[k].join('\n')));
			[ 'protocol', 'service', 'preset', 'category', 'remote_list' ].forEach((k) => r[k].length && set(k, r[k]));
		});
		if (p.mode)
			uci.set('we1ssconnect', 'main', 'mode', p.mode);
		return this.map.renderContents().then(() => true);
	},

	handleSave: function(ev) {
		if (this.mode != 'text')
			return this.super('handleSave', [ ev ]);
		return this.applyText().then((ok) => ok && this.super('handleSave', [ ev ]));
	},

	handleSaveApply: function(ev, mode) {
		if (this.mode != 'text')
			return this.super('handleSaveApply', [ ev, mode ]);
		return this.applyText().then((ok) => ok && this.super('handleSave', [ ev ]).then(() => ui.changes.apply(mode == '0')));
	},

	handleReset: function(ev) {
		if (this.mode != 'text')
			return this.super('handleReset', [ ev ]);
		this.textarea.value = this.text();
		this.check();
	},
});
