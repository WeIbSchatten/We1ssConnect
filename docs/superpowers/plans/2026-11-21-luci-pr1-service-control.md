# LuCI redesign PR 1: service control and shared components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** podkop-style service control (Start / Stop / Restart, autostart separately) on the Diagnostics page, a status line on every page, and the shared component kit + visual refresh the later page PRs build on.

**Architecture:** The service's "should run" state moves from uci `main.enabled` to a runtime flag `/var/run/we1ssconnect/wanted` written by the init script; autostart is plain procd `enable/disable`. One rpcd method `service(action)` drives both. LuCI gets reusable components in `we1ssconnect/common.js`; pure decision logic lives in a browser-free module unit-tested in Node.

**Tech Stack:** ucode, procd/rc.common, rpcd ucode plugin, LuCI JS views, Node `node:test` with `openwrt/tests/lib/luci-shim.mjs`, Playwright e2e in the `luci` CI job.

**Spec:** `docs/superpowers/specs/2026-11-21-luci-redesign-design.md` (section "Service control", "Delivery" step 1).

Later PRs (Devices, Routing, Servers, Settings, Overview/Diagnostics polish) each get their own plan, written when this one is merged, on top of the components produced here.

## Global Constraints

- LuCI 24.10 (opkg/ipk) and 25.12 (apk); both must pass `.github/workflows/openwrt.yml`.
- No Docker locally: ucode, init and LuCI tests run only in CI. Never run tests on the owner's live router.
- ucode gotchas (`openwrt/DESIGN.md`): POSIX regex, no function hoisting, 24.10 `rindex()` / empty `substr`.
- Every new `_('…')` string gets a Russian entry in `openwrt/i18n/ru.json`, then `node openwrt/i18n/i18n.mjs openwrt/luci-app-we1ssconnect openwrt/i18n/ru.json` and commit the regenerated `po/` (the `translations` job diffs it).
- Comments: at most 2 lines per block, explain why, not what.
- Commits: conventional (`feat(openwrt): …`), body explains why; **no Co-Authored-By trailer**.
- Must look right in themes bootstrap and proton2025, light and dark, and at 375 px width.
- Copy (ru): service states «Работает» / «Остановлена»; autostart «Включён» / «Выключен»; buttons «Запустить», «Остановить», «Перезапустить», «Включить автозапуск», «Выключить автозапуск». English msgids: `Running`, `Stopped`, `Enabled`, `Disabled`, `Start`, `Stop`, `Restart`, `Enable autostart`, `Disable autostart`.

## Review Focus

1. A stopped service must stay stopped after a uci change (LuCI save, `reload_config`), a `lists-update`, a subscription refresh or the background Xray download — pinned in Task 2's booted test.
2. A legacy router with `main.enabled=0` must come out of the upgrade stopped with autostart off — pinned in Task 3.
3. An upgrade of a running, autostart-on router keeps it running and enabled; a stopped one stays stopped — pinned in Task 3.
4. A config that fails `prepare` while wanted: the next fixing edit restarts it (wanted survives a failed start) — pinned in Task 2.
5. Pressing a service button twice fast (double click) must not leave the UI out of sync: buttons disable while a command runs — pinned in Task 5's e2e.

---

### Task 1: `wanted` flag, `service(action)`, autostart in status

**Files:**
- Modify: `openwrt/we1ssconnect/files/etc/init.d/we1ssconnect`
- Modify: `openwrt/we1ssconnect/files/usr/share/ucode/we1ssconnect/service.uc` (`status()` :262, `restart_if_running()` :360, `start_xray_install()` :174, `set_enabled()` :539)
- Modify: `openwrt/we1ssconnect/files/usr/share/ucode/we1ssconnect/config.uc:110` (drop `enabled`)
- Modify: `openwrt/we1ssconnect/files/etc/config/we1ssconnect` (drop `option enabled` from `main`)
- Modify: `openwrt/we1ssconnect/files/usr/share/rpcd/ucode/we1ssconnect.uc:10`
- Modify: `openwrt/luci-app-we1ssconnect/root/usr/share/rpcd/acl.d/luci-app-we1ssconnect.json`
- Modify: `openwrt/we1ssconnect/files/usr/bin/we1ssconnect` (usage + switch)
- Modify: `openwrt/tests/integration.sh`, `openwrt/tests/e2e.sh`, `openwrt/tests/protocols.sh` (replace `uci set we1ssconnect.main.enabled=1`; they call `prepare`/`apply-net` directly, so they only need the line removed)
- Test: `openwrt/tests/integration.sh` (autostart cases, no procd needed)

**Interfaces:**
- Produces (ucode, `we1ssconnect.service`):
  - `export const WANTED = RUN_DIR + '/wanted'`
  - `export function service(action)` — `action` ∈ `start|stop|restart|enable|disable`; returns `status()`; unknown action → `{ ok: false, error: 'action must be start, stop, restart, enable or disable' }`.
  - `status()` gains `autostart: bool` (`/etc/init.d/we1ssconnect enabled` exit 0) and `wanted: bool` (`WANTED` exists). `enabled` is removed from the output.
  - `restart_if_wanted()` replaces `restart_if_running()` at all 7 call sites.
- Produces (rpcd): `service: { args: { action: '' } }`; `set_enabled` removed; ACL write list: `service` instead of `set_enabled`.
- Produces (CLI): `we1ssconnect start|stop|restart|enable|disable` → prints `status()` JSON.
- init script: `start_service` creates `$RUN_DIR/wanted` before `prepare` (so a failed start stays wanted) and no longer reads `main.enabled`; `stop_service` is unchanged; `reload_service` = `[ -e "$RUN_DIR/wanted" ] || return 0; stop; start`. Stop removes the flag in `service('stop')` (not in `stop_service`, which `restart` also calls).
- Xray background install: `… xray-install > /dev/null && [ -e ${WANTED} ] && /etc/init.d/we1ssconnect restart …`.

- [ ] **Step 1: Write failing checks in `integration.sh`** (after files are copied; procd is absent, so only autostart and the flag):

```sh
/etc/init.d/we1ssconnect disable
check "disable: status shows autostart off" 'we1ssconnect status | grep -q "\"autostart\": false"'
we1ssconnect enable > /dev/null
check "enable: init script starts at boot" '/etc/init.d/we1ssconnect enabled'
check "enable: status shows autostart on" 'we1ssconnect status | grep -q "\"autostart\": true"'
we1ssconnect disable > /dev/null
check "disable: init script no longer starts at boot" '! /etc/init.d/we1ssconnect enabled'
check "unknown action is refused" 'ucode -L /usr/share/ucode -e "import { service } from \"we1ssconnect.service\"; print(service(\"boot\").error)" | grep -q "must be start"'
mkdir -p /var/run/we1ssconnect; touch /var/run/we1ssconnect/wanted
check "status reports wanted" 'we1ssconnect status | grep -q "\"wanted\": true"'
rm -f /var/run/we1ssconnect/wanted
```

(The unit container has no procd, so start/stop/restart are covered by Task 2 in the booted container.)

- [ ] **Step 2: Push to a branch and confirm the `test` job fails on these checks** (no local Docker).

Run: `git push -u origin HEAD && gh run watch --exit-status $(gh run list -w openwrt.yml -b <branch> -L1 --json databaseId -q '.[0].databaseId')`
Expected: FAIL lines for the new checks.

- [ ] **Step 3: Implement the Interfaces above.** `service()` runs `/etc/init.d/we1ssconnect <action>` through `sh()`; `start`/`restart` create `WANTED` first (`mkdir_p(RUN_DIR)`), `stop` deletes it first.

- [ ] **Step 4: Update docs that describe the old switch:** `docs/content/docs/{ru,en}/openwrt/cli.mdx:27` (now `we1ssconnect enable` / `start`), and add the five commands to the CLI page's command list.

- [ ] **Step 5: Push, CI `test` job green** (both 24.10 and 25.12).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(openwrt): separate start/stop from autostart, like podkop" -m "One switch both stopped the tunnel and turned off boot start, which users could not tell apart. A runtime 'wanted' flag now says whether the user wants it running; autostart is plain procd enable/disable."
```

### Task 2: nothing starts a stopped service (booted test)

**Files:**
- Create: `openwrt/tests/service_test.sh` (runs inside the booted `owrt` container)
- Modify: `openwrt/tests/luci-setup.sh:52` (`ubus call we1ssconnect service '{"action":"start"}'`)
- Modify: `.github/workflows/openwrt.yml` luci job: after "Boot it and connect", step `docker exec owrt sh /src/tests/service_test.sh`, then re-start it so LuCI e2e sees a running service.

**Interfaces:** Consumes Task 1's `service()` via `ubus call we1ssconnect service`.

- [ ] **Step 1: Write `service_test.sh`** with the same `check` helper as `e2e.sh` and these cases, in order:
  1. `stop` → `status.running == false`, `wanted == false`.
  2. stopped + `uci set we1ssconnect.main.log_level=info; uci commit we1ssconnect; reload_config; sleep 3` → still not running.
  3. stopped + `we1ssconnect lists-update` → still not running.
  4. `start` → running within 10 s; `autostart` unchanged from before the call.
  5. running + break the config (`uci set we1ssconnect.main.dns_type=bogus`… pick any value `prepare` rejects, e.g. `uci set we1ssconnect.main.clash_port=0`), commit, `reload_config` → not running, `wanted == true`; restore the value, commit, `reload_config` → running again.
  6. `restart` → running.
  7. `disable` → `autostart == false` and still running; `enable` → `autostart == true`.
  Exit non-zero on any failure.

- [ ] **Step 2: Run it in CI against Task 1 code; fix until green.** Case 2 and 5 are the ones that would fail on today's `reload_service`.

- [ ] **Step 3: Commit** `test(openwrt): a stopped service stays stopped through edits and list refreshes`.

### Task 3: package scripts keep state; legacy migration; fresh install stopped

**Files:**
- Modify: `openwrt/we1ssconnect/Makefile` (`postinst` :47-56, add `preinst`)
- Modify: `openwrt/tests/luci-setup.sh` (`install` branch)

**Interfaces:**
- `preinst` (shell, runs from the new package before files land): if `/etc/init.d/we1ssconnect` exists, write `/tmp/we1ssconnect.pkg` with `autostart=0|1` (`/etc/init.d/we1ssconnect enabled`) and `running=0|1` (`pidof sing-box` AND `nft list table inet we1ssconnect`); a legacy `uci -q get we1ssconnect.main.enabled` = `0` forces `autostart=0`.
- `postinst`: keep rpcd reload and take-over; then
  - no `/tmp/we1ssconnect.pkg` → fresh install: `/etc/init.d/we1ssconnect disable; /etc/init.d/we1ssconnect stop`;
  - else: `enable` or `disable` per `autostart`; `restart` only if `running=1`, else `stop`; `rm /tmp/we1ssconnect.pkg`.
  - always: `uci -q delete we1ssconnect.main.enabled; uci commit we1ssconnect`.
  - OpenWrt's `default_postinst` may already `enable`/`start` the init script before our block; our block runs after it and decides the final state, so it must set both explicitly.

- [ ] **Step 1: Extend `luci-setup.sh install`** after installing: assert fresh install → `! /etc/init.d/we1ssconnect enabled` and `! pidof sing-box`. Then simulate a legacy upgrade: `uci set we1ssconnect.main.enabled=0; /etc/init.d/we1ssconnect enable; uci commit`, reinstall (`opkg install --force-reinstall /pkgs/we1ssconnect_*.ipk` / `apk add --allow-untrusted --force-overwrite /pkgs/we1ssconnect-*.apk` after `apk del we1ssconnect`-free reinstall; use `apk fix --reinstall we1ssconnect` if `add` is a no-op for the same version — verify which works in the 25.12 job) → assert autostart off and `uci -q get we1ssconnect.main.enabled` empty.
- [ ] **Step 2: Add the running-upgrade case to `service_test.sh`** (booted, procd present): `enable; start`, reinstall the package, assert running and autostart on; `stop`, reinstall, assert still stopped.
- [ ] **Step 3: CI red on today's postinst, then implement, CI green.**
- [ ] **Step 4: Update `docs/content/docs/{ru,en}/openwrt/install.mdx:52`, `setup.mdx:39`, `index.mdx:76`, `troubleshooting.mdx:45-49`** to the new flow: after install go to Diagnostics → Start (or the Start button on Overview), autostart is off until enabled.
- [ ] **Step 5: Commit** `fix(openwrt): upgrades keep the service and autostart as they were`.

### Task 4: component kit and visual refresh in `common.js`

Use the `frontend-design` skill for the look. Direction: calm, product-like, theme-neutral — colours derived from `currentColor` + one accent (the existing green `#1f9a55` for "on"), translucent surfaces, 14 px radius, generous spacing, tabular numbers, no fixed backgrounds that clash with dark themes.

**Files:**
- Create: `openwrt/luci-app-we1ssconnect/htdocs/luci-static/resources/we1ssconnect/state.js` (pure logic, `baseclass` + `_()` only, loads under `luci-shim.mjs`)
- Modify: `openwrt/luci-app-we1ssconnect/htdocs/luci-static/resources/we1ssconnect/common.js` (CSS + components + `service` rpc)
- Test: `openwrt/tests/state_test.mjs`; add `node --test openwrt/tests/state_test.mjs` to the `translations` job next to `rules_test.mjs`

**Interfaces:**
- `state.js` produces:
  - `serviceActions(st) -> string[]`: `st.running ? ['stop','restart'] : ['start','restart']`, then `st.autostart ? 'disable' : 'enable'`.
  - `serviceLabel(st) -> { text, kind }`: running → `{ text: _('Running'), kind: 'on' }`; `st.error` and not running → `{ text: _('Error'), kind: 'err' }`; wanted and not running → `{ text: _('Starting…'), kind: 'off' }`; else `{ text: _('Stopped'), kind: 'off' }`.
  - `ACTION_LABELS`: `{ start: _('Start'), stop: _('Stop'), restart: _('Restart'), enable: _('Enable autostart'), disable: _('Disable autostart') }`.
- `common.js` produces (all return DOM nodes; `this.style()` is called by each):
  - `service: call('service', ['action'])` (replaces `setEnabled`).
  - `button(label, kind, fn)` — `kind` ∈ `primary|ghost|danger`; while `fn()`'s promise is pending the button is disabled and shows a spinner; our own `.w1-btn` styling, not `cbi-button`.
  - `statusLine(st, serverName)` — dot + `serviceLabel` + `· serverName` (omitted when not running).
  - `serviceBlock(st, onChange)` — the two rows from the spec ("Service … [buttons]", "Autostart … [button]"); each button calls `service(action)` then `onChange(newStatus)`.
  - `header(title, sub, st)` — existing signature plus optional status for the status line on the right.
- [ ] **Step 1: Write `state_test.mjs`**: four `serviceActions` cases (running×autostart) with exact arrays, e.g. `{running:false, autostart:true}` → `['start','restart','disable']`; `serviceLabel` for running, error, wanted-not-running, stopped with exact `text`.
- [ ] **Step 2: `node --test openwrt/tests/state_test.mjs`** → FAIL (module missing).
- [ ] **Step 3: Implement `state.js`, then the `common.js` components and CSS.**
- [ ] **Step 4: `node --test openwrt/tests/state_test.mjs openwrt/tests/rules_test.mjs`** → PASS.
- [ ] **Step 5: Translations** (ru copy from Global Constraints), regenerate `po/`.
- [ ] **Step 6: Commit** `feat(openwrt): shared LuCI components and a calmer look`.

### Task 5: Diagnostics service block, Overview start button, status line everywhere

**Files:**
- Modify: `view/we1ssconnect/diagnostics.js` (service block first, above checks; polls status every 5 s)
- Modify: `view/we1ssconnect/overview.js` (remove Connect/Disconnect toggle; when not running a large primary «Запустить» button in the Tunnel card; when running only the state)
- Modify: `view/we1ssconnect/{servers,routing,devices,settings}.js` (pass status to `header()`; load `w1.status()`)
- Modify: `openwrt/tests/luci-e2e.mjs`

**Interfaces:** Consumes `serviceBlock`, `statusLine`, `button`, `header(title, sub, st)` from Task 4.

- [ ] **Step 1: Extend `luci-e2e.mjs`** (service is running on entry): open diagnostics → «Работает» visible and «Остановить» button; click it twice quickly → after it settles, «Остановлена» shown and «Запустить» visible, `ubus`-free check via the page only; open overview → large «Запустить» visible; click it → overview shows «Работает»; back on diagnostics click «Выключить автозапуск» → «Выключен»; click «Включить автозапуск» → «Включён». Every page shows the status line text «Работает». Screenshots for each state. Update the `pages` expectations (`overview` now expects «Работает»).
- [ ] **Step 2: CI `luci` job red, implement, green** on both releases.
- [ ] **Step 3: Visual check:** download the `luci-screenshots-*` artifacts and look at every page at 1280 px; add one 375 px pass (`page.setViewportSize({width:375,height:812})`) for overview and diagnostics to the e2e screenshots. Also check proton2025 manually only if the owner installs this build; note it in the PR otherwise.
- [ ] **Step 4: Commit** `feat(openwrt): podkop-style service controls on Diagnostics`.

### Task 6: PR

- [ ] Open the PR (body in Russian, as usual for this repo; no co-author trailer; end with the Claude Code line), list what was not verified (proton2025, real router).
- [ ] Merge rule for this repo: merge when `openwrt.yml` checks and `check` pass — do not wait for the Android build. Ask the owner before merging.
