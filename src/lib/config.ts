import type { Settings, XrayOutbound } from './types';

export const PROXY_TAG = 'proxy';

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

/** The outbound as it will run: tagged "proxy" and with the Reality fingerprint fixed. */
export function prepareOutbound(outbound: XrayOutbound, settings: Settings): XrayOutbound {
  const out: XrayOutbound = JSON.parse(JSON.stringify(outbound));
  out.tag = PROXY_TAG;
  const reality = out.streamSettings?.realitySettings;
  if (settings.forceChromeFingerprint && out.streamSettings?.security === 'reality' && reality) {
    reality.fingerprint = 'chrome';
  }
  return out;
}

/** Full Xray config for the VPN: TUN in, the server out, DNS answered through the server. */
export function buildVpnConfig(outbound: XrayOutbound, settings: Settings): string {
  const rules: Record<string, unknown>[] = [
    { type: 'field', inboundTag: ['tun-in'], port: '53', outboundTag: 'dns-out' },
  ];
  if (settings.bypassLan) rules.push({ type: 'field', ip: PRIVATE_IPS, outboundTag: 'direct' });

  const config = {
    log: { loglevel: 'warning' },
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
      prepareOutbound(outbound, settings),
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
      { tag: 'dns-out', protocol: 'dns' },
    ],
    routing: { domainStrategy: 'AsIs', rules },
  };
  return JSON.stringify(config);
}

/** Minimal config pingBatch needs: just the outbound to measure. */
export function buildPingConfig(outbound: XrayOutbound, settings: Settings): string {
  return JSON.stringify({ outbounds: [prepareOutbound(outbound, settings)] });
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
