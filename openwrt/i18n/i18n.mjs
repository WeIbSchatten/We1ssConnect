// Extracts _('...') strings and menu titles from luci-app-we1ssconnect and writes the .pot and,
// the ru .po from i18n/ru.json ({msgid: msgstr}). Run: node openwrt/i18n/i18n.mjs openwrt/luci-app-we1ssconnect openwrt/i18n/ru.json
import fs from 'node:fs';
import path from 'node:path';

const app = process.argv[2];
const files = [];
(function walk(d) {
	for (const f of fs.readdirSync(d)) {
		const p = path.join(d, f);
		if (fs.statSync(p).isDirectory()) walk(p);
		else if (p.endsWith('.js')) files.push(p);
	}
})(path.join(app, 'htdocs'));

const ids = new Set();
const re = /_\('((?:[^'\\]|\\.)*)'\)/g;
for (const f of files.sort()) {
	const s = fs.readFileSync(f, 'utf8');
	for (const m of s.matchAll(re)) ids.add(m[1].replace(/\\'/g, "'"));
}
const menu = JSON.parse(fs.readFileSync(path.join(app, 'root/usr/share/luci/menu.d/luci-app-we1ssconnect.json'), 'utf8'));
for (const k in menu) ids.add(menu[k].title);

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const head = 'msgid ""\nmsgstr "Content-Type: text/plain; charset=UTF-8\\n"\n';
let pot = head;
for (const id of ids) pot += `\nmsgid "${esc(id)}"\nmsgstr ""\n`;
fs.mkdirSync(path.join(app, 'po/templates'), { recursive: true });
fs.writeFileSync(path.join(app, 'po/templates/we1ssconnect.pot'), pot);

if (process.argv[3]) {
	const tr = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
	const missing = [...ids].filter((id) => !tr[id] && id !== 'We1ssConnect');
	if (missing.length) {
		console.error('missing translations:\n' + missing.join('\n'));
		process.exit(1);
	}
	let po = head.replace('charset=UTF-8\\n"', 'charset=UTF-8\\n"\n"Language: ru\\n"');
	for (const id of ids) po += `\nmsgid "${esc(id)}"\nmsgstr "${esc(tr[id] || id)}"\n`;
	fs.mkdirSync(path.join(app, 'po/ru'), { recursive: true });
	fs.writeFileSync(path.join(app, 'po/ru/we1ssconnect.po'), po);
} else {
	console.log(JSON.stringify([...ids], null, 1));
}
