#!/bin/sh
# Package upgrades on a booted OpenWrt keep the service and autostart as the user left them.
# Needs the built packages in /pkgs. Runs after service_test.sh.
set -u
. "$(dirname "$0")/lib/pkg.sh"

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
field() { ubus call we1ssconnect status | jsonfilter -e "@.$1"; }
svc() { ubus call we1ssconnect service "{\"action\":\"$1\"}" > /dev/null; }
up() { [ "$(field running)" = true ]; }
up_within() { i=0; until up; do i=$((i + 1)); [ "$i" -le "$1" ] || return 1; sleep 1; done; }

svc enable
svc start
up_within 15
out1="$(reinstall)"; out="$out1"
check "the upgrade ran our postinst" 'echo "$out" | grep -q "We1ssConnect: kept"'
check "a running service runs after the upgrade" 'up_within 20'
check "autostart stays on" '[ "$(field autostart)" = true ]'

svc stop
svc disable
# prepare rewrites the config on every start, so its age shows a start that was undone later.
before="$(date -r /var/run/we1ssconnect/config.json +%s)"
sleep 1
out="$(reinstall)"
check "a stopped service stays stopped after the upgrade" 'sleep 3; ! up'
check "and is not even started for a moment during it" '[ "$(date -r /var/run/we1ssconnect/config.json +%s)" = "$before" ]'
check "autostart stays off" '[ "$(field autostart)" = false ]'

# Wanted but failing on a bad config: the upgrade keeps it wanted, so the fixing edit restarts it.
svc enable
uci set we1ssconnect.main.urltest_interval=bogus; uci commit we1ssconnect
svc start
sleep 3
out="$(reinstall)"
check "an upgrade keeps a failing service wanted" '[ "$(field wanted)" = true ]'
# reload_config acts on changes since its last run, which saw 3m: fix it with another valid value.
uci set we1ssconnect.main.urltest_interval=5m; uci commit we1ssconnect; reload_config
up_within 20 || fail "the service runs again for the LuCI test"
[ "$fails" -gt 0 ] && { echo "--- running upgrade"; echo "$out1"; echo "--- stopped upgrade"; echo "$out"; ubus call we1ssconnect status; logread | grep -i we1ss | tail -20; }
echo "upgrade: $fails failed"
[ "$fails" -eq 0 ]
