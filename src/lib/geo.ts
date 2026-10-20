import XrayVpn from 'xray-vpn';

import { needsGeo } from './config';
import type { Settings } from './types';

/** Rule files for the routing presets: Russian IP ranges and the v2fly domain lists. */
export const GEO_FILES = {
  'geoip.dat': 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download/geoip.dat',
  'geosite.dat': 'https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat',
};

const MAX_AGE = 7 * 24 * 3600_000;

export function updateGeo(): Promise<number> {
  return XrayVpn.downloadGeo(GEO_FILES);
}

/** Makes sure the presets have their files; an old copy is refreshed but still used if that fails. */
export async function ensureGeo(settings: Settings): Promise<void> {
  if (!needsGeo(settings)) return;
  const at = XrayVpn.geoUpdatedAt();
  if (at === 0) {
    await updateGeo();
  } else if (Date.now() - at > MAX_AGE) {
    await updateGeo().catch(() => undefined);
  }
}
