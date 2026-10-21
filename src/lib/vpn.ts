import { useSyncExternalStore } from 'react';
import XrayVpn, { type VpnStatus } from 'xray-vpn';

import { ensureGeo } from './geo';
import { buildPingConfig, buildVpnConfig, PING_URL, serverEndpoint, serverTag } from './config';
import { t } from './i18n';
import { allServers, fastestServer, getState, isAuto, selectedServer, setPings } from './store';
import type { Server } from './types';

let status: VpnStatus = XrayVpn.status();
const statusListeners = new Set<() => void>();

XrayVpn.addListener('onStatus', (next) => {
  status = next;
  statusListeners.forEach((l) => l());
});

export function getVpnStatus(): VpnStatus {
  return status;
}

export function subscribeVpnStatus(onChange: () => void) {
  statusListeners.add(onChange);
  // The service may have changed state while nobody was listening.
  status = XrayVpn.status();
  return () => {
    statusListeners.delete(onChange);
  };
}

export function useVpnStatus(): VpnStatus {
  return useSyncExternalStore(subscribeVpnStatus, () => status);
}

export function isActive(): boolean {
  return status.state === 'connected' || status.state === 'connecting';
}

/** The pinned server's outbound tag, or "" in automatic mode. */
function currentTarget(): string {
  const server = selectedServer();
  return isAuto() || !server ? '' : serverTag(server.id);
}

export async function connect(): Promise<void> {
  const state = getState();
  const servers = allServers(state);
  const fallback = selectedServer(state) ?? fastestServer(state);
  if (!fallback || servers.length === 0) throw new Error(t('noServers'));
  if (!(await XrayVpn.prepare())) throw new Error(t('vpnDenied'));
  try {
    await ensureGeo(state.settings);
  } catch (e) {
    throw new Error(t('geoFailed', { error: (e as Error).message }));
  }
  const title = isAuto(state) ? (state.settings.balancer === 'roundRobin' ? t('autoRoundRobin') : t('auto')) : fallback.name;
  XrayVpn.start(
    buildVpnConfig(servers, fallback, state.settings),
    title,
    currentTarget(),
    state.settings.appMode,
    state.settings.apps,
  );
}

export function disconnect(): void {
  XrayVpn.stop();
}

/** Applies the current selection to the running tunnel without reconnecting. */
export async function applySelection(): Promise<void> {
  if (status.state !== 'connected') return;
  await XrayVpn.setTarget(currentTarget());
}

/** Settings that are part of the config need a reconnect to take effect. */
export async function reconnectIfActive(): Promise<void> {
  if (!isActive()) return;
  await connect();
}

// libXray measures at most five configs per call.
const PING_BATCH = 5;
let lastPingAll = 0;
let pinging: Promise<void> | null = null;

/** Round trip to each server's own address (TCP connect, ICMP for UDP servers); works with the VPN on. */
export async function serverPings(servers: Server[]): Promise<Record<string, number>> {
  const targets = servers.map((s) => serverEndpoint(s.outbound) ?? { host: '', port: 0, udp: false });
  const delays = await XrayVpn.serverPing(JSON.stringify(targets), 3000);
  return Object.fromEntries(servers.map((s, i) => [s.id, targets[i].host ? (delays[i] ?? -1) : -1]));
}

/** Measures every server's delay: to the server itself, or through it with the VPN off. */
export function pingAll(): Promise<void> {
  const full = getState().settings.pingMode === 'full';
  if (full && isActive()) return Promise.reject(new Error(t('pingStopFirst')));
  pinging ??= (async () => {
    try {
      const servers = allServers();
      const settings = getState().settings;
      if (!full) {
        setPings(await serverPings(servers));
      } else {
        for (let i = 0; i < servers.length; i += PING_BATCH) {
          const batch = servers.slice(i, i + PING_BATCH);
          const delays = await XrayVpn.ping(
            batch.map((s) => buildPingConfig(s.outbound, settings)),
            PING_URL,
            5,
          );
          setPings(Object.fromEntries(batch.map((s, j) => [s.id, delays[j] ?? -1])));
        }
      }
      lastPingAll = Date.now();
    } finally {
      pinging = null;
    }
  })();
  return pinging;
}

/** Pings once in a while on its own when the VPN is off and the setting allows it. */
export function autoPing(): void {
  const { autoPing: on, pingMode } = getState().settings;
  if (!on || (pingMode === 'full' && isActive())) return;
  if (Date.now() - lastPingAll < 3 * 60_000 || allServers().length === 0) return;
  pingAll().catch(() => undefined);
}

export function isPinging(): boolean {
  return pinging !== null;
}
