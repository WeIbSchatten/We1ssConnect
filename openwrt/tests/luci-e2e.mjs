// Logs into LuCI, opens every We1ssConnect page, fails on JavaScript errors or a page that
// does not render its content, and saves screenshots. Usage: node luci-e2e.mjs <base url> <out dir>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const pages = [
	['overview', 'Подключено'],
	['servers', 'Нидерланды'],
	['routing', 'Через туннель'],
	['devices', 'Устройства'],
	['settings', 'Протокол DNS'],
	['diagnostics', 'sing-box запущен'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });

await page.goto(`${base}/cgi-bin/luci/`);
await page.fill('input[name="luci_username"]', 'root');
await page.fill('input[name="luci_password"]', 'test');
await Promise.all([page.waitForNavigation(), page.press('input[name="luci_password"]', 'Enter')]);

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

// Pinning a server from the list must reach sing-box without a page reload.
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/servers`);
await page.getByText('Нидерланды').first().click();
await page.waitForTimeout(1500);
const pinned = await page.locator('.w1-row.w1-selected').innerText();
if (/Нидерланды/.test(pinned)) console.log('ok   servers: the clicked server is pinned');
else { console.log(`FAIL servers: selected row is "${pinned}"`); failed++; }
await page.screenshot({ path: `${out}/servers-pinned.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/cgi-bin/luci/admin/services/we1ssconnect/overview`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/overview-mobile.png`, fullPage: true });

for (const e of errors) console.log(`JS error: ${e}`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
