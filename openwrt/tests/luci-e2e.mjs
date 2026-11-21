// Logs into LuCI, opens every We1ssConnect page, fails on JavaScript errors or a page that
// does not render its content, and saves screenshots. Usage: node luci-e2e.mjs <base url> <out dir>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const pages = [
	['overview', 'Работает'],
	['servers', 'Нидерланды'],
	['routing', 'market.example'],
	['devices', 'Устройства'],
	['settings', 'Протокол DNS'],
	['diagnostics', 'sing-box запущен'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/cgi-bin/luci/`);
await page.fill('input[name="luci_username"]', 'root');
await page.fill('input[name="luci_password"]', 'test');
await Promise.all([page.waitForNavigation(), page.press('input[name="luci_password"]', 'Enter')]);

// From here on: LuCI's own login form answers 403 and probes uci before the session exists.
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });

let failed = 0;
for (const [name, text] of pages) {
	await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/${name}`);
	try {
		await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20000 });
		console.log(`ok   ${name}: "${text}" is shown`);
	} catch {
		console.log(`FAIL ${name}: "${text}" never appeared`);
		failed++;
	}
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

// The install took podkop over; the overview says so and how to undo it.
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/overview`);
try {
	await page.getByText('выключены из автозапуска: podkop', { exact: false }).first().waitFor({ timeout: 20000 });
	console.log('ok   overview: says podkop was stopped');
} catch {
	console.log('FAIL overview: no notice about the stopped podkop');
	failed++;
}

// The service's English config warnings reach a Russian LuCI translated, arguments kept.
const shown = await page.evaluate(() => L.require('we1ssconnect.common').then((w1) => [
	w1.warning('selective mode: no rule sends traffic through the tunnel'),
	w1.warning('rule YouTube: target group:x is not available'),
]));
const want = [
	'Выборочный режим, но ни одно включённое правило не отправляет трафик в туннель: включите правило или перейдите в глобальный режим.',
	'Правило YouTube: цель group:x недоступна.',
];
if (JSON.stringify(shown) === JSON.stringify(want)) console.log('ok   warnings are translated');
else { console.log(`FAIL warnings: ${JSON.stringify(shown)}`); failed++; }

// Pinning a server from the list must reach sing-box without a page reload.
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/servers`);
await page.getByText('Нидерланды').first().click();
await page.waitForTimeout(1500);
const pinned = await page.locator('.w1-row.w1-selected').innerText();
if (/Нидерланды/.test(pinned)) console.log('ok   servers: the clicked server is pinned');
else { console.log(`FAIL servers: selected row is "${pinned}"`); failed++; }
await page.screenshot({ path: `${out}/servers-pinned.png`, fullPage: true });

// The rule editor shows the rule's services ticked and a summary, never "null".
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/routing`);
await page.locator('tr.cbi-section-table-row').filter({ hasText: 'market.example' }).locator('.cbi-button-edit').first().click();
const modal = page.locator('.modal');
await modal.waitFor({ timeout: 20000 });
const youtube = await modal.locator('.w1-checklist input[value="youtube"]').isChecked().catch(() => false);
const modalText = await modal.innerText();
if (youtube && !/\bnull\b/.test(modalText)) console.log('ok   routing: the rule editor shows its services and summary');
else { console.log(`FAIL routing editor: youtube ticked=${youtube}, null shown=${/\bnull\b/.test(modalText)}`); failed++; }
await page.screenshot({ path: `${out}/routing-editor.png`, fullPage: true });

// Rules typed as text are saved as rule sections and read back as the same text.
const typed = 'default: direct\nprotocol(bittorrent)->direct\n\n# Заблокированные\ndomain(geosite:refilter)->proxy\ndomain(market.example)->proxy(Нидерланды)\n';
const printed = 'default: direct\n\nprotocol(bittorrent)->direct\n\n# Заблокированные\ndomain(geosite:refilter)->proxy\ndomain(market.example)->proxy(Нидерланды)\n';
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/routing`);
await page.getByRole('button', { name: 'Текстом' }).click();
await page.locator('textarea.w1-rules-text').fill(typed);
await page.locator('.cbi-page-actions .cbi-button-apply').click();
await page.waitForTimeout(15000);
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/routing`);
const text = page.locator('textarea.w1-rules-text');
await text.waitFor({ timeout: 20000 });
const back = await text.inputValue();
const sections = await page.evaluate(() => L.require('uci').then((uci) =>
	uci.load('we1ssconnect').then(() => uci.sections('we1ssconnect', 'rule').map((s) => [s.action, s.protocol || s.category || s.domain]))));
if (back === printed && JSON.stringify(sections) === JSON.stringify([['direct', ['bittorrent']], ['proxy', ['geosite:refilter']], ['proxy', 'market.example']]))
	console.log('ok   routing: rules typed as text are saved and read back');
else { console.log(`FAIL routing text: ${JSON.stringify(back)} ${JSON.stringify(sections)}`); failed++; }
await page.screenshot({ path: `${out}/routing-text.png`, fullPage: true });

// Service control as in podkop: Diagnostics stops, restarts and sets autostart; Overview only starts.
const url = (name) => `${base}/cgi-bin/luci/admin/services/we1ssconnect/${name}`;
async function seen(scope, text, what) {
	try {
		await scope.getByText(text, { exact: true }).first().waitFor({ timeout: 30000 });
		console.log(`ok   ${what}`);
	} catch {
		console.log(`FAIL ${what}`);
		failed++;
	}
}
await page.goto(url('diagnostics'));
const service = page.locator('.w1-panel .w1-prow').nth(0), autostart = page.locator('.w1-panel .w1-prow').nth(1);
await seen(service, 'Работает', 'diagnostics: the service is running');
// A double click must send one command; the button stays disabled until it is done.
await service.locator('.w1-btn', { hasText: 'Остановить' }).dblclick();
await seen(service, 'Остановлена', 'diagnostics: Stop stops the service');
await seen(service, 'Запустить', 'diagnostics: a stopped service offers Start');
await page.screenshot({ path: `${out}/diagnostics-stopped.png`, fullPage: true });

await page.goto(url('overview'));
await page.locator('.w1-orb').click();
await seen(page.locator('.w1-head'), 'Работает', 'overview: the orb starts the service');
await page.screenshot({ path: `${out}/overview-running.png`, fullPage: true });

await page.goto(url('diagnostics'));
await seen(autostart, 'Включён', 'diagnostics: autostart is on');
await autostart.locator('.w1-btn', { hasText: 'Выключить автозапуск' }).click();
await seen(autostart, 'Выключен', 'diagnostics: Disable autostart turns it off');
await seen(service, 'Работает', 'diagnostics: turning autostart off leaves the service running');
await autostart.locator('.w1-btn', { hasText: 'Включить автозапуск' }).click();
await seen(autostart, 'Включён', 'diagnostics: Enable autostart turns it back on');

await page.setViewportSize({ width: 375, height: 812 });
for (const name of ['overview', 'diagnostics']) {
	await page.goto(url(name));
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `${out}/${name}-mobile.png`, fullPage: true });
}

for (const e of errors) console.log(`JS error: ${e}`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
