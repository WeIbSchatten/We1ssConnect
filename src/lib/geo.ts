import XrayVpn from 'xray-vpn';

import { needsGeo } from './config';
import type { Settings } from './types';

/** runetfreedom: v2fly's categories plus Russian ones, the same data the router reads as .srs. */
export const GEO_FILES = {
  'geoip.dat': 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download/geoip.dat',
  'geosite.dat': 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download/geosite.dat',
};

const MAX_AGE = 7 * 24 * 3600_000;
const SOURCE_KEY = 'geo.source';

export async function updateGeo(): Promise<number> {
  const at = await XrayVpn.downloadGeo(GEO_FILES);
  XrayVpn.setItem(SOURCE_KEY, JSON.stringify(GEO_FILES));
  return at;
}

/**
 * Makes sure the rules have their files; an old copy is refreshed but still used if that fails.
 * Files from another source may lack a category a rule names, so they count as missing.
 */
export async function ensureGeo(settings: Settings): Promise<void> {
  if (!needsGeo(settings)) return;
  const sameSource = XrayVpn.getItem(SOURCE_KEY) === JSON.stringify(GEO_FILES);
  const at = sameSource ? XrayVpn.geoUpdatedAt() : 0;
  if (at === 0) {
    await updateGeo();
  } else if (Date.now() - at > MAX_AGE) {
    await updateGeo().catch(() => undefined);
  }
}
