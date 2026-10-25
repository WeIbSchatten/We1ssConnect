import { buildVpnConfig, needsGeo, prepareOutbound, serverAddress, serverEndpoint } from './config';
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

test('presets add ad blocking, RU direct and the RU resolver', () => {
  const settings = { ...DEFAULT_SETTINGS, ruDirect: true, blockAds: true };
  const config = JSON.parse(buildVpnConfig(servers, servers[0], settings));
  const tags = config.routing.rules.map((r: { outboundTag?: string }) => r.outboundTag);
  expect(tags).toEqual(['dns-out', 'direct', 'block', 'direct', 'direct', undefined]);
  expect(config.routing.domainStrategy).toBe('IPIfNonMatch');
  expect(config.dns.servers[0]).toMatchObject({ address: '77.88.8.8', skipFallback: true });
});

test('fragment dials TLS servers through the fragment outbound; mux skips Vision', () => {
  const vision: XrayOutbound = { ...reality, settings: { ...reality.settings, flow: 'xtls-rprx-vision' } };
  const trojan: XrayOutbound = {
    protocol: 'trojan',
    settings: { address: 't.example', port: 443 },
    streamSettings: { network: 'ws', security: 'tls' },
  };
  const settings = { ...DEFAULT_SETTINGS, fragment: true, mux: true };
  expect(prepareOutbound(vision, settings, 'x').streamSettings?.sockopt).toEqual({ dialerProxy: 'fragment' });
  expect(prepareOutbound(vision, settings, 'x').mux).toBeUndefined();
  expect(prepareOutbound(trojan, settings, 'x').mux).toMatchObject({ enabled: true });
  const config = JSON.parse(buildVpnConfig(servers, servers[0], settings));
  expect(config.outbounds.some((o: { tag: string }) => o.tag === 'fragment')).toBe(true);
});

test('DoH and IPv6 change the resolver', () => {
  const config = JSON.parse(
    buildVpnConfig(servers, servers[0], { ...DEFAULT_SETTINGS, dns: 'google', dnsOverHttps: true, ipv6: true }),
  );
  expect(config.dns).toEqual({ servers: ['https://8.8.8.8/dns-query'], queryStrategy: 'UseIP' });
});

test('server endpoint marks UDP-only servers for ICMP', () => {
  expect(serverEndpoint(reality)).toEqual({ host: 'example.com', port: 443, udp: false });
  expect(serverEndpoint({ protocol: 'hysteria', settings: { address: 'h.example', port: '8443' } })).toEqual({
    host: 'h.example',
    port: 8443,
    udp: true,
  });
});

test('custom rules come before the presets: block, then through the VPN, then direct', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    ruDirect: true,
    customRules: {
      proxy: ['geosite:youtube', 'geoip:telegram'],
      direct: ['example.org', '10.20.0.0/16'],
      block: ['geosite:category-ads-all', 'bad typo entry'],
    },
  };
  const rules = JSON.parse(buildVpnConfig(servers, servers[0], settings)).routing.rules;
  expect(rules.slice(2, 7)).toEqual([
    { type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'block' },
    { type: 'field', domain: ['geosite:youtube'], balancerTag: 'main' },
    { type: 'field', ip: ['geoip:telegram'], balancerTag: 'main' },
    { type: 'field', domain: ['domain:example.org'], outboundTag: 'direct' },
    { type: 'field', ip: ['10.20.0.0/16'], outboundTag: 'direct' },
  ]);
  expect(rules[7]).toMatchObject({ domain: expect.arrayContaining(['geosite:category-ru']), outboundTag: 'direct' });
});

test('IP rules need sniffed domains resolved; geo entries need the rule files', () => {
  const ipOnly = { ...DEFAULT_SETTINGS, customRules: { proxy: [], direct: ['geoip:ru'], block: [] } };
  expect(JSON.parse(buildVpnConfig(servers, servers[0], ipOnly)).routing.domainStrategy).toBe('IPIfNonMatch');
  expect(needsGeo(ipOnly)).toBe(true);
  const domains = { ...DEFAULT_SETTINGS, customRules: { proxy: ['example.com'], direct: [], block: [] } };
  expect(JSON.parse(buildVpnConfig(servers, servers[0], domains)).routing.domainStrategy).toBe('AsIs');
  expect(needsGeo(domains)).toBe(false);
});
