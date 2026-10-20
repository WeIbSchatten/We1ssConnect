import { useSyncExternalStore } from 'react';
import XrayVpn from 'xray-vpn';

import { serverIdFromTag } from './config';
import { getVpnStatus, subscribeVpnStatus } from './vpn';

export interface IpInfo {
  ip: string;
  countryCode?: string;
  country?: string;
  city?: string;
  isp?: string;
}

/** What the running tunnel reports; reset on every disconnect. */
export interface Live {
  connectedAt: number | null;
  /** Bytes per second, averaged over the last poll. */
  upSpeed: number;
  downSpeed: number;
  upTotal: number;
  downTotal: number;
  /** Server id → delay in ms (-1: not answering), from the observatory. */
  pings: Record<string, number>;
  /** The server the balancer would pick by delay (what automatic mode uses). */
  activeId?: string;
  ip?: IpInfo;
  ipError?: boolean;
}

const EMPTY: Live = { connectedAt: null, upSpeed: 0, downSpeed: 0, upTotal: 0, downTotal: 0, pings: {} };

let live: Live = EMPTY;
const listeners = new Set<() => void>();

function set(patch: Partial<Live>) {
  live = { ...live, ...patch };
  listeners.forEach((l) => l());
}

export function useLive<T>(select: (l: Live) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(live),
  );
}

const POLL_MS = 2000;
let timer: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
let lastTraffic: { up: number; down: number; at: number } | null = null;
let ipFor: string | undefined;

async function pollTraffic() {
  const raw = JSON.parse(await XrayVpn.traffic()) as { up: number; down: number };
  const now = Date.now();
  if (lastTraffic) {
    const seconds = Math.max(0.5, (now - lastTraffic.at) / 1000);
    set({
      upSpeed: Math.max(0, (raw.up - lastTraffic.up) / seconds),
      downSpeed: Math.max(0, (raw.down - lastTraffic.down) / seconds),
      upTotal: raw.up,
      downTotal: raw.down,
    });
  }
  lastTraffic = { ...raw, at: now };
}

async function pollServers() {
  const statuses = JSON.parse(await XrayVpn.observation()) as { tag: string; alive: boolean; delay: number }[];
  const pings: Record<string, number> = {};
  for (const s of statuses) {
    const id = serverIdFromTag(s.tag);
    if (id) pings[id] = s.alive ? s.delay : -1;
  }
  const activeId = serverIdFromTag(await XrayVpn.balancerTarget().catch(() => ''));
  set({ pings, activeId });
  // The exit IP depends on the server, so look it up again when the balancer moves.
  // A pinned server never moves here; picking one calls lookupIp itself.
  if (ipFor === undefined || (activeId && activeId !== ipFor)) {
    ipFor = activeId ?? '';
    void lookupIp();
  }
}

/** Exit IP and country, fetched through the tunnel. */
export async function lookupIp(): Promise<void> {
  const sources: [string, (j: Record<string, unknown>) => IpInfo][] = [
    [
      'https://api.ip.sb/geoip',
      (j) => ({
        ip: String(j.ip),
        countryCode: j.country_code as string | undefined,
        country: j.country as string | undefined,
        city: j.city as string | undefined,
        isp: (j.isp ?? j.organization) as string | undefined,
      }),
    ],
    [
      'https://ipwho.is/',
      (j) => ({
        ip: String(j.ip),
        countryCode: j.country_code as string | undefined,
        country: j.country as string | undefined,
        city: j.city as string | undefined,
        isp: (j.connection as { isp?: string } | undefined)?.isp,
      }),
    ],
  ];
  for (const [url, parse] of sources) {
    try {
      const info = parse(JSON.parse(await XrayVpn.httpGet(url, 8000)));
      if (info.ip && info.ip !== 'undefined') {
        set({ ip: info, ipError: false });
        return;
      }
    } catch {
      // Try the next source.
    }
  }
  set({ ipError: true });
}

function start() {
  if (timer) return;
  live = { ...EMPTY, connectedAt: Date.now() };
  lastTraffic = null;
  ipFor = undefined;
  ticks = 0;
  const tick = () => {
    if (getVpnStatus().state !== 'connected') return;
    pollTraffic().catch(() => undefined);
    // Delays change slowly; the observatory probes every 30 s.
    if (ticks++ % 3 === 0) pollServers().catch(() => undefined);
  };
  tick();
  timer = setInterval(tick, POLL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  set(EMPTY);
}

function sync() {
  if (getVpnStatus().state === 'connected') start();
  else stop();
}

subscribeVpnStatus(sync);
sync();

/** Countries as flag emoji: two regional indicator symbols. */
export function flag(code?: string): string {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
