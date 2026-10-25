'use strict';
'require view';
'require form';
'require uci';
'require we1ssconnect.common as w1';

return view.extend({
	load: function() {
		return Promise.all([ w1.leases().catch(() => ({})), uci.load('we1ssconnect') ]);
	},

	render: function(data) {
		const leases = (data[0] && data[0].dhcp_leases) || [];
		let m, s, o;

		m = new form.Map('we1ssconnect', null,
			_('Like per-app routing on the phone: a device can send everything through the tunnel, or nothing at all. Give such devices a static DHCP lease so their address does not change.'));
		w1.style();

		s = m.section(form.GridSection, 'device', _('Devices'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;
		s.modaltitle = _('Device');

		o = s.option(form.Value, 'name', _('Name'));

		o = s.option(form.Value, 'ip', _('IP address'));
		o.datatype = 'ip4addr("nomask")';
		o.rmempty = false;
		leases.forEach((l) => o.value(l.ipaddr, '%s (%s)'.format(l.ipaddr, l.hostname || l.macaddr)));

		o = s.option(form.ListValue, 'mode', _('Traffic'));
		o.value('tunnel', _('Everything through the tunnel'));
		o.value('bypass', _('Nothing through the tunnel'));
		o.default = 'tunnel';

		return m.render();
	},
});
