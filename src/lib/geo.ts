import XrayVpn from 'xray-vpn';

import { needsGeo } from './config';
import lite from './geo-lite.json';
import { parseEntries } from './rules';
import type { Settings } from './types';

const DATASET = 'runetfreedom/russia-v2ray-rules-dat';
const LITE_REPO = 'WeIbSchatten/We1ssConnect';

/**
 * runetfreedom: v2fly's categories plus Russian ones, the same data the router reads as .srs (~100 MB).
 * raw.githubusercontent.com first: GitHub's release downloads answer 504 for days at a time.
 */
export const FULL_SOURCES: Record<string, string>[] = [
  {
    'geoip.dat': `https://raw.githubusercontent.com/${DATASET}/release/geoip.dat`,
    'geosite.dat': `https://raw.githubusercontent.com/${DATASET}/release/geosite.dat`,
  },
  {
    'geoip.dat': `https://github.com/${DATASET}/releases/latest/download/geoip.dat`,
    'geosite.dat': `https://github.com/${DATASET}/releases/latest/download/geosite.dat`,
  },
];

/** The same files cut to geo-lite.json (~9 MB) by .github/workflows/geo.yml; jsDelivr when GitHub is slow. */
export const LITE_SOURCES: Record<string, string>[] = [
  {
    'geoip.dat': `https://raw.githubusercontent.com/${LITE_REPO}/geo/geoip.dat`,
    'geosite.dat': `https://raw.githubusercontent.com/${LITE_REPO}/geo/geosite.dat`,
  },
  {
    'geoip.dat': `https://cdn.jsdelivr.net/gh/${LITE_REPO}@geo/geoip.dat`,
    'geosite.dat': `https://cdn.jsdelivr.net/gh/${LITE_REPO}@geo/geosite.dat`,
  },
];

export type GeoDataset = 'lite' | 'full';

const MAX_AGE = 7 * 24 * 3600_000;
const SOURCE_KEY = 'geo.source';
const LITE = new Set([...lite.geosite.map((c) => 'geosite:' + c), ...lite.geoip.map((c) => 'geoip:' + c)]);

/** The smallest file set that has every category the settings name. */
export function geoDataset(settings: Settings): GeoDataset {
  const used: string[] = [];
  if (settings.ruDirect) used.push('geosite:category-ru', 'geoip:ru');
  if (settings.blockAds) used.push('geosite:category-ads-all');
  const all = [...settings.customRules.proxy, ...settings.customRules.direct, ...settings.customRules.block];
  if (all.some((e) => /^\s*ext:/i.test(e))) return 'full';
  const parsed = parseEntries(all);
  used.push(...[...parsed.domain, ...parsed.ip].filter((e) => /^geo(site|ip):/.test(e)));
  return used.every((c) => LITE.has(c)) ? 'lite' : 'full';
}

/** Which set the files on the device came from; the full set also serves the lite categories. */
function storedDataset(): GeoDataset | null {
  const source = XrayVpn.getItem(SOURCE_KEY) ?? '';
  if (source.includes(DATASET)) return 'full';
  if (source.includes(LITE_REPO)) return 'lite';
  return null;
}

export async function updateGeo(settings: Settings): Promise<number> {
  let error: unknown;
  // The full files hold every lite category too, so they back up a small set GitHub will not serve.
  for (const files of geoDataset(settings) === 'lite' ? [...LITE_SOURCES, ...FULL_SOURCES] : FULL_SOURCES) {
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

let refreshing: Promise<unknown> | null = null;

/**
 * Makes sure the rules have their files. Files on the device let the tunnel go up at once and are
 * refreshed in the background when old; without them it resolves false and connects without the
 * geo rules instead of not at all.
 */
export async function ensureGeo(settings: Settings): Promise<boolean> {
  if (!needsGeo(settings)) return true;
  const stored = storedDataset();
  const usable = stored === 'full' || stored === geoDataset(settings);
  const at = usable ? XrayVpn.geoUpdatedAt() : 0;
  if (at === 0) {
    try {
      await updateGeo(settings);
    } catch {
      return false;
    }
  } else if (Date.now() - at > MAX_AGE && !refreshing) {
    refreshing = updateGeo(settings)
      .catch(() => undefined)
      .finally(() => (refreshing = null));
  }
  return true;
}
