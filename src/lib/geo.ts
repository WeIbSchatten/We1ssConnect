import XrayVpn from 'xray-vpn';

import { needsGeo } from './config';
import type { Settings } from './types';

const DATASET = 'runetfreedom/russia-v2ray-rules-dat';

/**
 * runetfreedom: v2fly's categories plus Russian ones, the same data the router reads as .srs.
 * raw.githubusercontent.com first: GitHub's release downloads answer 504 for days at a time.
 */
export const GEO_SOURCES: Record<string, string>[] = [
  {
    'geoip.dat': `https://raw.githubusercontent.com/${DATASET}/release/geoip.dat`,
    'geosite.dat': `https://raw.githubusercontent.com/${DATASET}/release/geosite.dat`,
  },
  {
    'geoip.dat': `https://github.com/${DATASET}/releases/latest/download/geoip.dat`,
    'geosite.dat': `https://github.com/${DATASET}/releases/latest/download/geosite.dat`,
  },
];
export const GEO_FILES = GEO_SOURCES[0];

const MAX_AGE = 7 * 24 * 3600_000;
const SOURCE_KEY = 'geo.source';

export async function updateGeo(): Promise<number> {
  let error: unknown;
  for (const files of GEO_SOURCES) {
    try {
      const at = await XrayVpn.downloadGeo(files);
      XrayVpn.setItem(SOURCE_KEY, JSON.stringify(files));
      return at;
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

/**
 * Makes sure the rules have their files; an old copy is refreshed but still used if that fails.
 * Resolves false when there are none, so the connection goes up without the geo rules instead
 * of not at all. Files from another dataset may lack a category a rule names: they count as missing.
 */
export async function ensureGeo(settings: Settings): Promise<boolean> {
  if (!needsGeo(settings)) return true;
  const sameSource = (XrayVpn.getItem(SOURCE_KEY) ?? '').includes(DATASET);
  const at = sameSource ? XrayVpn.geoUpdatedAt() : 0;
  if (at === 0) {
    try {
      await updateGeo();
    } catch {
      return false;
    }
  } else if (Date.now() - at > MAX_AGE) {
    await updateGeo().catch(() => undefined);
  }
  return true;
}
