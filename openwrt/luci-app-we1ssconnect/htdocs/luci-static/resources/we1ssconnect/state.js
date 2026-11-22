'use strict';
'require baseclass';

// What the service controls show for a status, kept free of the DOM so Node can test it.

const ACTION_LABELS = {
	start: _('Start the service'), stop: _('Stop the service'), restart: _('Restart the service'),
	enable: _('Enable autostart'), disable: _('Disable autostart'),
};

return baseclass.extend({
	ACTION_LABELS: ACTION_LABELS,

	// As in podkop: Start or Stop by state, Restart always, autostart by its own state.
	serviceActions: function(st) {
		return [ st.running ? 'stop' : 'start', 'restart', st.autostart ? 'disable' : 'enable' ];
	},

	// An error counts only while the service should run: a stopped one keeps its last start's error.
	serviceLabel: function(st) {
		if (st.running)
			return { text: _('Service is running'), kind: 'on' };
		if (st.wanted && st.error)
			return { text: _('Error'), kind: 'err' };
		if (st.wanted)
			return { text: _('Starting…'), kind: 'off' };
		return { text: _('Service is stopped'), kind: 'off' };
	},
});
