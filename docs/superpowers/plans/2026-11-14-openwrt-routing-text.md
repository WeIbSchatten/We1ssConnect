# OpenWrt: маршрутизация текстом — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** вид «Текстом» для правил маршрутизации OpenWrt и условие `protocol(...)`, выпуск 1.11.2 только для OpenWrt.

**Architecture:** uci-секции `rule` остаются хранилищем. Новый LuCI-модуль `we1ssconnect/rules.js` переводит текст ⇄ секции, вид `routing.js` переключается между формой и textarea. Служба получает `list protocol` → sing-box `protocol`.

**Tech Stack:** ucode (служба, тесты в контейнерах OpenWrt в CI), LuCI JS, Node `node --test` для `rules.js`, Playwright (`luci-e2e.mjs`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-14-openwrt-routing-text-design.md`

## Global Constraints

- Протоколы: `http tls quic stun dns bittorrent dtls ssh rdp ntp`.
- Ключи `service`/`preset` — из `w1.SERVICES`/`w1.PRESETS` (`common.js`).
- Категория: `^geo(site|ip):[a-z0-9][a-z0-9._!-]*$`, адрес проверки — `CATEGORY_BASE` из `lists.uc`.
- `ru.json` правится инструментом Edit (отступ 1 пробел), затем `node openwrt/i18n/i18n.mjs openwrt/luci-app-we1ssconnect openwrt/i18n/ru.json`.
- Тесты ucode идут только в CI (`openwrt/tests/ci.sh`); на живом роутере ничего не запускать.
- Коммиты без Co-Authored-By.

## Review Focus

- Текст с CRLF (вставка из Windows) разбирается как с LF — тест в Task 2.
- Пробелы и регистр: `Domain( Example.com ) -> PROXY` — ключевые слова без учёта регистра, значения обрезаются — тест в Task 2.
- Правило, у которого цель-сервер исчезла (в uci `server:zz`), собирается в `proxy(server:zz)` и разбирается обратно без потери — тест в Task 2.
- Пустой текст = ни одного правила, режим не меняется — тест в Task 2.
- Домены в uci, записанные списком или через запятую/пробелы (старые конфиги), собираются по строке на домен — тест в Task 2.

---

### Task 1: условие `protocol` в службе

**Files:** Modify `openwrt/we1ssconnect/files/usr/share/ucode/we1ssconnect/config.uc` (ветка `rule`), `.../singbox.uc` (цикл по `cfg.rules`); Test `openwrt/tests/config_test.uc`, `openwrt/tests/singbox_test.uc`.

**Interfaces:** Produces: `cfg.rules[i].protocols: string[]`; ошибка `rule <name>: bad protocol <p>`; sing-box правило `{ protocol: [...], outbound|action }`.

- [ ] Тест `config_test.uc` «protocols are read and checked»: секция `{ '.type':'rule', '.name':'r1', name:'BT', action:'direct', protocol:['bittorrent','BitTorrent','gopher'] }` → `rules[0].protocols == ['bittorrent']`, `errors == ['rule BT: bad protocol gopher']`.
- [ ] Тест `singbox_test.uc` «a protocol rule goes before the default and passes sing-box check»: правило `{ action:'direct', protocols:['bittorrent'] }` в global-режиме даёт в `route.rules` элемент `{ protocol:['bittorrent'], outbound:'direct' }`, `check(config)` проходит; в `dns.rules` нет `protocol`.
- [ ] Реализовать: `PROTOCOLS` в `config.uc`, `protocols: uniq(...)` в правиле; в `singbox.uc` matcher `{ protocol }` в начале списка matchers, не попадает в DNS и в `tunnel_rules` считается как остальные.
- [ ] Добавить в `common.js` `WARNINGS` строку для `rule (.+): bad protocol (.+)`.
- [ ] Коммит `feat(openwrt): route by sniffed protocol`.

### Task 2: модуль `rules.js` и тесты в Node

**Files:** Create `openwrt/luci-app-we1ssconnect/htdocs/luci-static/resources/we1ssconnect/rules.js`, `openwrt/tests/rules_test.mjs`, `openwrt/tests/lib/luci-shim.mjs`; Modify `.github/workflows/openwrt.yml` (job `translations` → шаг `node --test openwrt/tests/rules_test.mjs`).

**Interfaces:** Produces (через `'require we1ssconnect.rules as rules'`):
- `rules.PROTOCOLS: string[]`
- `rules.parse(text, ctx) → { mode: 'selective'|'global'|null, rules: Rule[], errors: {line,msg}[], warnings: {line,msg}[], categories: {line,category}[] }`
- `rules.serialize(mode, rules, ctx) → string`
- `Rule = { enabled: bool, name: string, action: 'proxy'|'direct'|'block'|'vpn', target: string /* 'auto'|'group:<sid>'|'server:<id>' */, interface: string, protocol, service, preset, category, domain, subnet, remote_list: string[] }`
- `ctx = { groups: [{sid,name}], servers: [{id,name}], services: string[], presets: string[] }`
- `luci-shim.mjs`: `load(path) → module` — исполняет файл через `new Function('baseclass', src)` с `baseclass.extend = (o) => o`, глобальным `_ = (s) => s` и `String.prototype.format`.

- [ ] Тесты (`node:test`, `assert.deepStrictEqual`):
  - пример владельца из спеки (без wattpad) → `mode 'selective'`, 11 секций нужного порядка; блок «Заблокированные домены в РФ» — одна секция с тремя категориями и `name`;
  - каждое условие и действие таблицы спеки; `!` → `enabled:false`; `proxy(Финляндия)` → `group:<sid>`, при совпадении только с сервером → `server:<id>`;
  - ошибки со строками: `domain(x)->fly`, `service(nope)`, `protocol(gopher)`, `proxy(Нет такого)`, неоднозначное имя, `domain(bad domain)`, `ip(300.1.1.1)`, `list(ftp://x)`, `domain(geosite:google@cn)`, вторая строка `default:`, текст после правила `# …`;
  - предупреждение для `protocol(bittorrent)->proxy` при `default: direct`;
  - `categories` содержит каждую категорию со строкой;
  - обратимость: `serialize(parse(t))` стабильно после первого прохода; `parse(serialize(rules))` == `rules` на наборе с именем, содержащим `)`, и дублирующимися именами (сборка пишет `proxy(server:<id>)`);
  - пять случаев из Review Focus.
- [ ] Запуск: `node --test openwrt/tests/rules_test.mjs` → FAIL (нет модуля).
- [ ] Реализовать `rules.js` по разделам спеки «Синтаксис» и «Текст ↔ uci-секции».
- [ ] Запуск → PASS.
- [ ] Коммит `feat(openwrt): parse and print routing rules as text`.

### Task 3: вид «Текстом» и поле «Протоколы» в `routing.js`

**Files:** Modify `openwrt/luci-app-we1ssconnect/htdocs/luci-static/resources/view/we1ssconnect/routing.js`; `openwrt/i18n/ru.json`, `openwrt/luci-app-we1ssconnect/po/*` (генерация); Test `openwrt/tests/luci-e2e.mjs`.

**Interfaces:** Consumes `rules.parse/serialize/PROTOCOLS` (Task 2).

- [ ] e2e-шаг в `luci-e2e.mjs` (сначала, красный): на `routing` нажать «Текстом», заполнить textarea примером владельца, «Сохранить и применить», дождаться применения; проверить `uci show we1ssconnect` через `docker exec` нельзя из node — вместо этого перезагрузить страницу, переключиться на «Текстом» и сравнить текст с ожидаемым нормализованным; плюс скриншот.
- [ ] Переключатель «Формой / Текстом» над секцией правил (выбор хранится в `localStorage`, try/catch); textarea моноширинная, под ней список ошибок/предупреждений с номерами строк, обновляется при вводе.
- [ ] Сохранение в режиме текста: переопределить `handleSave`/`handleSaveApply`; при ошибках — `ui.addNotification` и отказ; иначе удалить все `rule`, `uci.add` по порядку, записать опции (`domain`/`subnet` — строкой через `\n`, остальное — списками, `enabled '0'` только для выключенных), `main.mode` при `default:`; затем штатное сохранение/применение. Перед сохранением HEAD-проверка категорий → предупреждения, не блокирует.
- [ ] Переход текст → форма только без ошибок (секции пишутся в uci без применения, форма перерисовывается); форма → текст собирает из текущего uci.
- [ ] Поле `protocol` (`ChecklistValue` с `rules.PROTOCOLS`, modalonly) и protocol в `summary()`.
- [ ] Строки в `ru.json`, генерация po; `node --test` и `git diff --exit-code -- openwrt/luci-app-we1ssconnect/po` после генерации чистые.
- [ ] Коммит `feat(openwrt): edit routing rules as text in LuCI`.

### Task 4: документация

**Files:** Modify `docs/content/docs/{ru,en}/openwrt/` страница маршрутизации (найти по `grep -l "Routing rules\|Правила маршрутизации"`).

- [ ] Раздел «Текстом» / «As text»: пример владельца, таблица условий и действий, `!`, `default:`, оговорка про `protocol` в выборочном режиме.
- [ ] Коммит `docs(openwrt): routing rules as text`.

### Task 5: релиз «только OpenWrt»

**Files:** Modify `.github/workflows/android.yml`.

**Interfaces:** новый `workflow_dispatch` input `openwrt_only` (boolean, default false).

- [ ] `android`, `desktop`, `smoke`: `if: ${{ !inputs.openwrt_only }}`; `release.if` принимает `skipped` для android/desktop только при `inputs.openwrt_only`.
- [ ] В `release` при `openwrt_only`: перед `sha256sum` скачать в `dist` файлы приложений из последнего релиза: `gh release download --pattern 'we1ssconnect-android-*' --pattern 'we1ssconnect-desktop-*' -D dist` (до создания нового).
- [ ] Не тестируется юнит-тестом: проверяется запуском релиза 1.11.2 — в релизе 11 файлов, приложения 1.11.1, пакеты OpenWrt 1.11.2.
- [ ] Коммит `ci(release): publish an OpenWrt-only release`.

### Task 6: PR, релиз 1.11.2

- [ ] PR фичи (Tasks 1–4), CI зелёный, слить.
- [ ] PR релиза: версия 1.11.2 в `app.json`, `package.json`, `package-lock.json`, `desktop/wails.json`; `CHANGELOG.md`, history ru/en, `docs/release-notes/1.11.2.md` (строка «Приложения для Android, Windows и Linux не менялись — в релизе файлы 1.11.1»); workflow из Task 5; `PANEL_VERSION=1.11.0 bash scripts/check-version-series.sh 1.11.2`.
- [ ] Слить, `gh workflow run android.yml -R WeIbSchatten/We1ssConnect --ref main -f version=1.11.2 -f openwrt_only=true`, проверить список файлов релиза.
