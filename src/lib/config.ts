import type { Server, Settings, XrayOutbound } from './types';

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

/** The outbound as it will run: tagged and with the Reality fingerprint fixed. */
export function prepareOutbound(outbound: XrayOutbound, settings: Settings, tag: string): XrayOutbound {
  const out: XrayOutbound = JSON.parse(JSON.stringify(outbound));
  out.tag = tag;
  const reality = out.streamSettings?.realitySettings;
  if (settings.forceChromeFingerprint && out.streamSettings?.security === 'reality' && reality) {
    reality.fingerprint = 'chrome';
  }
  return out;
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
  // Everything else, including Xray's own DNS queries, goes through the balancer.
  rules.push({ type: 'field', network: 'tcp,udp', balancerTag: BALANCER });

  const config = {
    log: { loglevel: 'warning' },
    stats: {},
    policy: { system: { statsOutboundUplink: true, statsOutboundDownlink: true } },
    dns: {
      servers: ['1.1.1.1', '8.8.8.8'],
      queryStrategy: 'UseIPv4',
    },
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
    ],
    observatory: {
      subjectSelector: [SERVER_PREFIX],
      probeUrl: PING_URL,
      probeInterval: '30s',
      enableConcurrency: true,
    },
    routing: {
      domainStrategy: 'AsIs',
      balancers: [
        {
          tag: BALANCER,
          selector: [SERVER_PREFIX],
          strategy: { type: 'leastPing' },
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
  return JSON.stringify({ outbounds: [prepareOutbound(outbound, settings, 'proxy')] });
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
