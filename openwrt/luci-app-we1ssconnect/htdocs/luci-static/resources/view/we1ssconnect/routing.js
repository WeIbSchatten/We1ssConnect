'use strict';
'require view';
'require form';
'require uci';
'require tools.widgets as widgets';
'require we1ssconnect.common as w1';

// What a rule matches, in words; also the row title of rules without a name.
function summary(sid) {
	const parts = [];
	[].concat(uci.get('we1ssconnect', sid, 'service') || []).forEach((k) => parts.push(w1.SERVICES[k] || k));
	[].concat(uci.get('we1ssconnect', sid, 'preset') || []).forEach((k) => parts.push(w1.PRESETS[k] || k));
	[].concat(uci.get('we1ssconnect', sid, 'category') || []).forEach((k) => parts.push(k));
	const dom = (uci.get('we1ssconnect', sid, 'domain') || '').split(/\s+/).filter((x) => x);
	if (dom.length)
		parts.push(dom.length > 2 ? _('%d domains').format(dom.length) : dom.join(', '));
	const net = (uci.get('we1ssconnect', sid, 'subnet') || '').split(/\s+/).filter((x) => x);
	if (net.length)
		parts.push(_('%d subnets').format(net.length));
	const rl = [].concat(uci.get('we1ssconnect', sid, 'remote_list') || []);
	if (rl.length)
		parts.push(_('%d remote lists').format(rl.length));
	return parts.join(' · ');
}

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

		o = s.option(form.MultiValue, 'service', _('Services'),
			_('Community lists of itdoginfo/allow-domains, refreshed automatically.'));
		for (const k in w1.SERVICES)
			o.value(k, w1.SERVICES[k]);
		o.display_size = 6;
		o.modalonly = true;

		o = s.option(form.MultiValue, 'preset', _('Presets'));
		for (const k in w1.PRESETS)
			o.value(k, w1.PRESETS[k]);
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

		o = s.option(form.TextValue, 'subnet', _('IP addresses and subnets'), _('One per line, such as 149.154.160.0/20.'));
		o.rows = 4;
		o.modalonly = true;

		o = s.option(form.DynamicList, 'remote_list', _('Remote lists'),
			_('URLs of sing-box rule-sets (.srs, .json) or plain lists of domains and subnets.'));
		o.modalonly = true;

		o = s.option(form.DummyValue, '_what', _('Matches'));
		o.textvalue = (sid) => summary(sid) || '—';

		s = m.section(form.GridSection, 'group', _('Server groups'),
			_('A group balances its servers by lowest delay. Point a rule at a group to keep, say, one country for one service.'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;
		s.modaltitle = _('Server group');

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;

		o = s.option(form.MultiValue, 'subscription', _('Subscriptions'));
		Object.keys(list.subscriptions || {}).forEach((id) => {
			const info = list.subscriptions[id];
			o.value(id, info.title || info.name || id);
		});
		o.value('manual', _('My keys'));

		o = s.option(form.MultiValue, 'server', _('Servers'));
		servers.forEach((x) => o.value(x.id, x.name));
		o.modalonly = true;

		o = s.option(form.Value, 'filter', _('Name filter'), _('Regular expression, such as finland|helsinki.'));

		return m.render();
	},
});
