import { buildVpnConfig, prepareOutbound, serverAddress } from './config';
import { DEFAULT_SETTINGS, type XrayOutbound } from './types';

const reality: XrayOutbound = {
  protocol: 'vless',
  tag: 'My Server',
  settings: { address: 'example.com', port: 443, id: 'uuid', encryption: 'none' },
  streamSettings: {
    network: 'raw',
    security: 'reality',
    realitySettings: { fingerprint: 'ios', serverName: 'www.google.com', password: 'pbk' },
  },
};

test('reality fingerprint becomes chrome when the fix is on', () => {
  const out = prepareOutbound(reality, DEFAULT_SETTINGS);
  expect(out.tag).toBe('proxy');
  expect(out.streamSettings?.realitySettings?.fingerprint).toBe('chrome');
  expect(reality.streamSettings?.realitySettings?.fingerprint).toBe('ios');
});

test('reality fingerprint is kept when the fix is off', () => {
  const out = prepareOutbound(reality, { ...DEFAULT_SETTINGS, forceChromeFingerprint: false });
  expect(out.streamSettings?.realitySettings?.fingerprint).toBe('ios');
});

test('vpn config routes DNS to the dns outbound and the rest to the server', () => {
  const config = JSON.parse(buildVpnConfig(reality, DEFAULT_SETTINGS));
  expect(config.inbounds[0].protocol).toBe('tun');
  expect(config.outbounds[0].tag).toBe('proxy');
  expect(config.routing.rules[0]).toMatchObject({ port: '53', outboundTag: 'dns-out' });
  expect(config.routing.rules[1].outboundTag).toBe('direct');
});

test('bypassLan off leaves private networks in the tunnel', () => {
  const config = JSON.parse(buildVpnConfig(reality, { ...DEFAULT_SETTINGS, bypassLan: false }));
  expect(config.routing.rules).toHaveLength(1);
});

test('server address reads flat and nested settings', () => {
  expect(serverAddress(reality)).toBe('example.com:443');
  expect(serverAddress({ protocol: 'vmess', settings: { vnext: [{ address: 'a.b', port: 8443 }] } })).toBe('a.b:8443');
});
