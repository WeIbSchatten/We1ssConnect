// state.js: which service buttons and which state label LuCI shows. Run: node --test openwrt/tests/state_test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { load } from './lib/luci-shim.mjs';

const state = load(fileURLToPath(new URL('../luci-app-we1ssconnect/htdocs/luci-static/resources/we1ssconnect/state.js', import.meta.url)));

test('a running service offers Stop and Restart, plus the opposite of its autostart', () => {
	assert.deepEqual(state.serviceActions({ running: true, autostart: true }), ['stop', 'restart', 'disable']);
	assert.deepEqual(state.serviceActions({ running: true, autostart: false }), ['stop', 'restart', 'enable']);
});

test('a stopped service offers Start and Restart, plus the opposite of its autostart', () => {
	assert.deepEqual(state.serviceActions({ running: false, autostart: true }), ['start', 'restart', 'disable']);
	assert.deepEqual(state.serviceActions({ running: false, autostart: false }), ['start', 'restart', 'enable']);
});

test('the label says what the service is doing', () => {
	assert.deepEqual(state.serviceLabel({ running: true, wanted: true }), { text: 'Running', kind: 'on' });
	assert.deepEqual(state.serviceLabel({ running: false, wanted: true, error: 'bad config' }), { text: 'Error', kind: 'err' });
	assert.deepEqual(state.serviceLabel({ running: false, wanted: true }), { text: 'Starting…', kind: 'off' });
	assert.deepEqual(state.serviceLabel({ running: false, wanted: false }), { text: 'Stopped', kind: 'off' });
});

test('a stopped service with an old error from its last start reads Stopped, not Error', () => {
	assert.deepEqual(state.serviceLabel({ running: false, wanted: false, error: 'bad config' }), { text: 'Stopped', kind: 'off' });
});
