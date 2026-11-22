#!/bin/sh
# Service control on a booted OpenWrt (procd running): start/stop/restart apart from autostart,
# and nothing brings back a service the user stopped. Runs after luci-setup.sh configure.
set -u

fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
field() { ubus call we1ssconnect status | jsonfilter -e "@.$1"; }
svc() { ubus call we1ssconnect service "{\"action\":\"$1\"}" > /dev/null; }
up() { [ "$(field running)" = true ]; }
# up_within <seconds>: a start returns before sing-box has its nft table in place.
up_within() { i=0; until up; do i=$((i + 1)); [ "$i" -le "$1" ] || return 1; sleep 1; done; }
edit() { uci set "we1ssconnect.main.$1=$2"; uci commit we1ssconnect; reload_config; sleep 4; }

svc start
up_within 15 || fail "the service runs before the test"

svc stop
check "stop: not running" '! up'
check "stop: no longer wanted" '[ "$(field wanted)" = false ]'

edit log_level info
check "a settings change leaves a stopped service stopped" '! up'
we1ssconnect lists-update > /dev/null
check "a list refresh leaves a stopped service stopped" '! up'

auto="$(field autostart)"
svc start
check "start: running" 'up_within 15'
check "start: autostart untouched" '[ "$(field autostart)" = "$auto" ]'

edit urltest_interval bogus
check "a config sing-box rejects stops the tunnel" '! up'
check "but it stays wanted" '[ "$(field wanted)" = true ]'
edit urltest_interval 3m
check "the edit that fixes it brings the tunnel back" 'up_within 15'

svc restart
check "restart: running" 'up_within 15'

svc disable
check "disable autostart: off" '[ "$(field autostart)" = false ]'
check "disable autostart: still running" 'up'
svc enable
check "enable autostart: on" '[ "$(field autostart)" = true ]'

# A stopped service drops the error its last start left; commands report their own outcome.
edit urltest_interval bogus
check "a stop after a failed start answers without the old error" 	'[ -z "$(ubus call we1ssconnect service "{\"action\":\"stop\"}" | jsonfilter -e @.error)" ]'
check "the CLI's disable succeeds on a stopped service with an old error" 'we1ssconnect disable > /dev/null'
svc enable
edit urltest_interval 3m
svc start
up_within 15 || fail "the service runs again for the next test"

echo "service: $fails failed"
[ "$fails" -eq 0 ]
