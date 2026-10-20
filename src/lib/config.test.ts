import { buildVpnConfig, prepareOutbound, serverAddress } from './config';
import { DEFAULT_SETTINGS, type Server, type XrayOutbound } from './types';

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

const servers: Server[] = [
  { id: 'a', name: 'A', outbound: reality },
  { id: 'b', name: 'B', outbound: { protocol: 'trojan', settings: { address: 'b.example', port: 443 } } },
];

test('reality fingerprint becomes chrome when the fix is on', () => {
  const out = prepareOutbound(reality, DEFAULT_SETTINGS, 'proxy');
  expect(out.tag).toBe('proxy');
  expect(out.streamSettings?.realitySettings?.fingerprint).toBe('chrome');
  expect(reality.streamSettings?.realitySettings?.fingerprint).toBe('ios');
});

test('reality fingerprint is kept when the fix is off', () => {
  const out = prepareOutbound(reality, { ...DEFAULT_SETTINGS, forceChromeFingerprint: false }, 'proxy');
  expect(out.streamSettings?.realitySettings?.fingerprint).toBe('ios');
});

test('vpn config puts every server behind the balancer', () => {
  const config = JSON.parse(buildVpnConfig(servers, servers[1], DEFAULT_SETTINGS));
  expect(config.inbounds[0].protocol).toBe('tun');
  expect(config.outbounds.map((o: { tag: string }) => o.tag)).toEqual(['s-a', 's-b', 'direct', 'block', 'dns-out']);
  expect(config.observatory.subjectSelector).toEqual(['s-']);
  expect(config.routing.balancers[0]).toMatchObject({ tag: 'main', selector: ['s-'], fallbackTag: 's-b' });
  const rules = config.routing.rules;
  expect(rules[0]).toMatchObject({ port: '53', outboundTag: 'dns-out' });
  expect(rules[1].outboundTag).toBe('direct');
  expect(rules[rules.length - 1]).toMatchObject({ network: 'tcp,udp', balancerTag: 'main' });
});

test('bypassLan off leaves private networks in the tunnel', () => {
  const config = JSON.parse(buildVpnConfig(servers, servers[0], { ...DEFAULT_SETTINGS, bypassLan: false }));
  expect(config.routing.rules).toHaveLength(2);
});

test('server address reads flat and nested settings', () => {
  expect(serverAddress(reality)).toBe('example.com:443');
  expect(serverAddress({ protocol: 'vmess', settings: { vnext: [{ address: 'a.b', port: 8443 }] } })).toBe('a.b:8443');
});
