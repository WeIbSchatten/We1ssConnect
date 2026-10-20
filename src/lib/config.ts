import type { DnsProvider, Server, Settings, XrayOutbound } from './types';

/** Server outbounds are tagged "s-<id>"; the observatory and balancer select them by prefix. */
export const SERVER_PREFIX = 's-';
export const BALANCER = 'main';
export const PING_URL = 'https://www.gstatic.com/generate_204';

export function serverTag(id: string): string {
  return SERVER_PREFIX + id;
}

export function serverIdFromTag(tag: string): string | undefined {
  return tag.startsWith(SERVER_PREFIX) ? tag.slice(SERVER_PREFIX.length) : undefined;
}

const PRIVATE_IPS = [
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'fc00::/7',
  'fe80::/10',
  '::1/128',
];

const RU_DOMAINS = ['geosite:category-ru', 'domain:ru', 'domain:su', 'domain:xn--p1ai'];

const DNS: Record<DnsProvider, { ip: string; doh: string }> = {
  cloudflare: { ip: '1.1.1.1', doh: 'https://1.1.1.1/dns-query' },
  google: { ip: '8.8.8.8', doh: 'https://8.8.8.8/dns-query' },
  quad9: { ip: '9.9.9.9', doh: 'https://9.9.9.9/dns-query' },
};
/** Yandex DNS answers Russian domains with addresses close to the user. */
const RU_DNS = '77.88.8.8';

/** Splits the TLS ClientHello into small pieces; servers dial through it. */
const FRAGMENT_OUTBOUND = {
  tag: 'fragment',
  protocol: 'freedom',
  settings: { fragment: { packets: 'tlshello', length: '100-200', interval: '10-20' } },
};

/** Geo rule files the routing presets need. */
export function needsGeo(settings: Settings): boolean {
  return settings.ruDirect || settings.blockAds;
}

function isTcpTls(out: XrayOutbound): boolean {
  const s = out.streamSettings;
  const network = (s?.network as string | undefined) ?? 'raw';
  return (
    out.protocol !== 'hysteria' &&
    (s?.security === 'tls' || s?.security === 'reality') &&
    !['kcp', 'mkcp', 'quic'].includes(network)
  );
}

function canMux(out: XrayOutbound): boolean {
  if (!['vless', 'vmess', 'trojan', 'shadowsocks'].includes(out.protocol)) return false;
  const network = (out.streamSettings?.network as string | undefined) ?? 'raw';
  if (network === 'xhttp' || network === 'splithttp') return false;
  // XTLS Vision does not work over mux.
  const settings = out.settings ?? {};
  const users = ((settings.vnext as { users?: { flow?: string }[] }[] | undefined)?.[0]?.users ?? []) as {
    flow?: string;
  }[];
  return !settings.flow && !users.some((u) => u.flow);
}

/** The outbound as it will run: tagged, with the Reality fingerprint fixed and the chosen tweaks. */
export function prepareOutbound(outbound: XrayOutbound, settings: Settings, tag: string): XrayOutbound {
  const out: XrayOutbound = JSON.parse(JSON.stringify(outbound));
  out.tag = tag;
  const reality = out.streamSettings?.realitySettings;
  if (settings.forceChromeFingerprint && out.streamSettings?.security === 'reality' && reality) {
    reality.fingerprint = 'chrome';
  }
  if (settings.fragment && isTcpTls(out) && out.streamSettings) {
    const sockopt = (out.streamSettings.sockopt as Record<string, unknown> | undefined) ?? {};
    out.streamSettings.sockopt = { ...sockopt, dialerProxy: FRAGMENT_OUTBOUND.tag };
  }
  if (settings.mux && canMux(out)) {
    out.mux = { enabled: true, concurrency: 8, xudpConcurrency: 8, xudpProxyUDP443: 'reject' };
  }
  return out;
}

function dnsConfig(settings: Settings) {
  const dns = DNS[settings.dns] ?? DNS.cloudflare;
  const servers: unknown[] = [settings.dnsOverHttps ? dns.doh : dns.ip];
  if (settings.ruDirect) servers.unshift({ address: RU_DNS, domains: RU_DOMAINS, skipFallback: true });
  return { servers, queryStrategy: settings.ipv6 ? 'UseIP' : 'UseIPv4' };
}

/**
 * Full Xray config for the VPN: TUN in, every server out behind one balancer.
 * The observatory keeps measuring all servers, so delays stay live while connected,
 * the balancer can pick the fastest one, and the app can pin any server without a restart.
 * fallback is the server used until the first measurements arrive.
 */
export function buildVpnConfig(servers: Server[], fallback: Server, settings: Settings): string {
  const rules: Record<string, unknown>[] = [
    { type: 'field', inboundTag: ['tun-in'], port: '53', outboundTag: 'dns-out' },
  ];
  if (settings.bypassLan) rules.push({ type: 'field', ip: PRIVATE_IPS, outboundTag: 'direct' });
  if (settings.blockAds) rules.push({ type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'block' });
  if (settings.ruDirect) {
    rules.push({ type: 'field', domain: RU_DOMAINS, outboundTag: 'direct' });
    rules.push({ type: 'field', ip: ['geoip:ru', RU_DNS], outboundTag: 'direct' });
  }
  // Everything else, including Xray's own DNS queries, goes through the balancer.
  rules.push({ type: 'field', network: 'tcp,udp', balancerTag: BALANCER });

  const config = {
    log: { loglevel: 'warning' },
    stats: {},
    policy: { system: { statsOutboundUplink: true, statsOutboundDownlink: true } },
    dns: dnsConfig(settings),
    inbounds: [
      {
        tag: 'tun-in',
        protocol: 'tun',
        settings: { name: 'tun0', mtu: 1500 },
        sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: true },
      },
    ],
    outbounds: [
      ...servers.map((s) => prepareOutbound(s.outbound, settings, serverTag(s.id))),
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
      { tag: 'dns-out', protocol: 'dns' },
      ...(settings.fragment ? [FRAGMENT_OUTBOUND] : []),
    ],
    observatory: {
      subjectSelector: [SERVER_PREFIX],
      probeUrl: PING_URL,
      probeInterval: '30s',
      enableConcurrency: true,
    },
    routing: {
      // geoip rules need an address; sniffed domains are resolved only when no domain rule matched.
      domainStrategy: settings.ruDirect ? 'IPIfNonMatch' : 'AsIs',
      balancers: [
        {
          tag: BALANCER,
          selector: [SERVER_PREFIX],
          // Xray spells the strategies in lower case.
          strategy: { type: settings.balancer === 'roundRobin' ? 'roundrobin' : 'leastPing' },
          fallbackTag: serverTag(fallback.id),
        },
      ],
      rules,
    },
  };
  return JSON.stringify(config);
}

/** Minimal config pingBatch needs: just the outbound to measure. */
export function buildPingConfig(outbound: XrayOutbound, settings: Settings): string {
  return JSON.stringify({
    outbounds: [prepareOutbound(outbound, settings, 'proxy'), ...(settings.fragment ? [FRAGMENT_OUTBOUND] : [])],
  });
}

export function serverAddress(outbound: XrayOutbound): string {
  const s = outbound.settings ?? {};
  const pick = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined);
  const flat = s as { address?: string; port?: number };
  const nested =
    pick((s.vnext as unknown[] | undefined)?.[0]) ?? pick((s.servers as unknown[] | undefined)?.[0]);
  const address = flat.address ?? (nested?.address as string | undefined);
  const port = flat.port ?? (nested?.port as number | undefined);
  if (!address) return '';
  return port ? `${address}:${port}` : address;
}

export function protocolLabel(outbound: XrayOutbound): string {
  const security = outbound.streamSettings?.security;
  const proto = outbound.protocol === 'hysteria' ? 'hysteria2' : outbound.protocol;
  return security && security !== 'none' ? `${proto} · ${security}` : proto;
}
