import { useSyncExternalStore } from 'react';
import XrayVpn, { type VpnStatus } from 'xray-vpn';

import { buildPingConfig, buildVpnConfig } from './config';
import { t } from './i18n';
import { allServers, getState, selectedServer, setPings } from './store';

let status: VpnStatus = XrayVpn.status();

function subscribe(onChange: () => void) {
  const sub = XrayVpn.addListener('onStatus', (next) => {
    status = next;
    onChange();
  });
  // The service may have changed state while nobody was listening.
  status = XrayVpn.status();
  return () => sub.remove();
}

export function useVpnStatus(): VpnStatus {
  return useSyncExternalStore(subscribe, () => status);
}

export async function connect(): Promise<void> {
  const server = selectedServer();
  if (!server) throw new Error(t('noServers'));
  if (!(await XrayVpn.prepare())) throw new Error(t('vpnDenied'));
  XrayVpn.start(buildVpnConfig(server.outbound, getState().settings), server.name);
}

export function disconnect(): void {
  XrayVpn.stop();
}

const PING_URL = 'https://www.gstatic.com/generate_204';
// libXray measures at most five configs per call.
const PING_BATCH = 5;

/** Measures every server's delay; libXray can only do it while the VPN is off. */
export async function pingAll(): Promise<void> {
  if (XrayVpn.status().state === 'connected' || XrayVpn.status().state === 'connecting') {
    throw new Error(t('pingStopFirst'));
  }
  const servers = allServers();
  const settings = getState().settings;
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
