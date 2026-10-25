// rpcd object "we1ssconnect" for luci-app-we1ssconnect.

'use strict';

import * as svc from 'we1ssconnect.service';

return {
	we1ssconnect: {
		status: { call: () => svc.status() },
		servers: { call: () => svc.servers() },
		ping: { call: () => svc.ping() },
		select: { args: { id: 'auto' }, call: (req) => svc.select(req.args.id) },
		import: { args: { text: '' }, call: (req) => svc.import_links(req.args.text) },
		remove: { args: { id: '' }, call: (req) => svc.remove_server(req.args.id) },
		sub_add: { args: { url: '', name: '' }, call: (req) => svc.sub_add(req.args.name, req.args.url) },
		sub_update: { args: { id: 'all' }, call: (req) => svc.sub_update(req.args.id || 'all') },
		sub_remove: { args: { id: '' }, call: (req) => svc.sub_remove(req.args.id) },
		exit_info: { call: () => svc.exit_info() },
		speedtest: { call: () => svc.speedtest() },
		diagnostics: { call: () => svc.diagnostics() },
		logs: { args: { lines: 200 }, call: (req) => svc.logs(req.args.lines) },
		update_check: { call: () => svc.update_check() },
		update: { call: () => svc.self_update() },
	},
};
