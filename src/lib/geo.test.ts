import XrayVpn from 'xray-vpn';

import { ensureGeo, FULL_SOURCES, geoDataset, LITE_SOURCES } from './geo';
import { DEFAULT_SETTINGS } from './types';

jest.mock('xray-vpn', () => {
  const items: Record<string, string | null> = {};
  return {
    __esModule: true,
    default: {
      geoUpdatedAt: jest.fn(),
      downloadGeo: jest.fn(async () => Date.now()),
      getItem: (k: string) => items[k] ?? null,
      setItem: (k: string, v: string | null) => {
        items[k] = v;
      },
    },
  };
});

const native = XrayVpn as unknown as { geoUpdatedAt: jest.Mock; downloadGeo: jest.Mock; setItem(k: string, v: string | null): void };
const presets = { ...DEFAULT_SETTINGS, ruDirect: true, blockAds: true };
const rare = { ...DEFAULT_SETTINGS, customRules: { proxy: ['geosite:ru-blocked-all'], direct: [], block: [] } };
const WEEK = 7 * 24 * 3600_000;

beforeEach(() => {
  native.downloadGeo.mockReset();
  native.downloadGeo.mockImplementation(async () => Date.now());
  native.geoUpdatedAt.mockReturnValue(Date.now());
  native.setItem('geo.source', null);
});

test('the presets and the common categories need only the small set', () => {
  expect(geoDataset(presets)).toBe('lite');
  expect(geoDataset({ ...DEFAULT_SETTINGS, customRules: { proxy: ['geosite:YouTube', 'geoip:telegram', 'example.com'], direct: [], block: [] } })).toBe('lite');
  expect(geoDataset(rare)).toBe('full');
  expect(geoDataset({ ...DEFAULT_SETTINGS, customRules: { proxy: [], direct: ['ext:my.dat:x'], block: [] } })).toBe('full');
});

test('without files the presets download the small set from our geo branch, then jsDelivr', async () => {
  native.geoUpdatedAt.mockReturnValue(0);
  native.downloadGeo.mockRejectedValueOnce(new Error('HTTP 504'));
  await expect(ensureGeo(presets)).resolves.toBe(true);
  expect(native.downloadGeo.mock.calls).toEqual([[LITE_SOURCES[0]], [LITE_SOURCES[1]]]);
  expect(LITE_SOURCES[0]['geosite.dat']).toBe('https://raw.githubusercontent.com/WeIbSchatten/We1ssConnect/geo/geosite.dat');
  expect(LITE_SOURCES[1]['geosite.dat']).toBe('https://cdn.jsdelivr.net/gh/WeIbSchatten/We1ssConnect@geo/geosite.dat');
});

test('when neither small source answers, the full files still work', async () => {
  native.geoUpdatedAt.mockReturnValue(0);
  native.downloadGeo.mockRejectedValueOnce(new Error('HTTP 404')).mockRejectedValueOnce(new Error('timeout'));
  await expect(ensureGeo(presets)).resolves.toBe(true);
  expect(native.downloadGeo.mock.calls).toEqual([[LITE_SOURCES[0]], [LITE_SOURCES[1]], [FULL_SOURCES[0]]]);
});

test('a category outside the small set downloads the full runetfreedom files', async () => {
  native.geoUpdatedAt.mockReturnValue(0);
  await ensureGeo(rare);
  expect(native.downloadGeo).toHaveBeenCalledWith(FULL_SOURCES[0]);
  expect(FULL_SOURCES[0]['geosite.dat']).toBe('https://raw.githubusercontent.com/runetfreedom/russia-v2ray-rules-dat/release/geosite.dat');
});

test('full files already on the device serve the presets without a download', async () => {
  native.setItem('geo.source', JSON.stringify(FULL_SOURCES[1]));
  await expect(ensureGeo(presets)).resolves.toBe(true);
  expect(native.downloadGeo).not.toHaveBeenCalled();
});

test('small files do not serve a rule that needs the full set', async () => {
  native.setItem('geo.source', JSON.stringify(LITE_SOURCES[1]));
  await expect(ensureGeo(rare)).resolves.toBe(true);
  expect(native.downloadGeo).toHaveBeenCalledWith(FULL_SOURCES[0]);
});

test('files from an unknown source are downloaded again', async () => {
  native.setItem('geo.source', JSON.stringify({ 'geosite.dat': 'https://old.example/dlc.dat' }));
  await ensureGeo(presets);
  expect(native.downloadGeo).toHaveBeenCalledWith(LITE_SOURCES[0]);
});

test('old files connect at once and are refreshed in the background', async () => {
  native.setItem('geo.source', JSON.stringify(LITE_SOURCES[0]));
  native.geoUpdatedAt.mockReturnValue(Date.now() - WEEK - 1);
  native.downloadGeo.mockImplementation(() => new Promise(() => undefined));
  await expect(ensureGeo(presets)).resolves.toBe(true);
  expect(native.downloadGeo).toHaveBeenCalledWith(LITE_SOURCES[0]);
});

test('nothing is downloaded when no rule needs the files', async () => {
  native.geoUpdatedAt.mockReturnValue(0);
  await expect(ensureGeo(DEFAULT_SETTINGS)).resolves.toBe(true);
  expect(native.downloadGeo).not.toHaveBeenCalled();
});

test('files that cannot be downloaded leave the rules out instead of failing the connection', async () => {
  native.geoUpdatedAt.mockReturnValue(0);
  native.downloadGeo.mockRejectedValue(new Error('blocked'));
  await expect(ensureGeo(presets)).resolves.toBe(false);
});
