import XrayVpn from 'xray-vpn';

import { ensureGeo, GEO_FILES, GEO_SOURCES } from './geo';
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
const withGeo = { ...DEFAULT_SETTINGS, customRules: { proxy: ['geosite:ru-blocked'], direct: [], block: [] } };

beforeEach(() => {
  native.downloadGeo.mockClear();
  native.geoUpdatedAt.mockReturnValue(Date.now());
});

test('fresh files from another source are downloaded again', async () => {
  native.setItem('geo.source', JSON.stringify({ 'geosite.dat': 'https://old.example/dlc.dat' }));
  await ensureGeo(withGeo);
  expect(native.downloadGeo).toHaveBeenCalledWith(GEO_FILES);
});

test('fresh files from the current source are kept', async () => {
  native.setItem('geo.source', JSON.stringify(GEO_FILES));
  await ensureGeo(withGeo);
  expect(native.downloadGeo).not.toHaveBeenCalled();
});

test('nothing is downloaded when no rule needs the files', async () => {
  native.setItem('geo.source', null);
  await ensureGeo(DEFAULT_SETTINGS);
  expect(native.downloadGeo).not.toHaveBeenCalled();
});

test('files are fetched from raw.githubusercontent.com: release downloads answer 504 for days', () => {
  expect(Object.values(GEO_SOURCES[0]).every((u) => u.startsWith('https://raw.githubusercontent.com/runetfreedom/'))).toBe(true);
  expect(GEO_FILES).toBe(GEO_SOURCES[0]);
});

test('a source that fails falls back to the next one', async () => {
  native.setItem('geo.source', null);
  native.geoUpdatedAt.mockReturnValue(0);
  native.downloadGeo.mockRejectedValueOnce(new Error('HTTP 504'));
  await expect(ensureGeo(withGeo)).resolves.toBe(true);
  expect(native.downloadGeo.mock.calls).toEqual([[GEO_SOURCES[0]], [GEO_SOURCES[1]]]);
});

test('files that cannot be downloaded leave the rules out instead of failing the connection', async () => {
  native.setItem('geo.source', null);
  native.geoUpdatedAt.mockReturnValue(0);
  native.downloadGeo.mockRejectedValue(new Error('blocked'));
  await expect(ensureGeo(withGeo)).resolves.toBe(false);
  native.downloadGeo.mockImplementation(async () => Date.now());
});

test('files kept from the old release URLs are the same data and stay', async () => {
  native.setItem('geo.source', JSON.stringify({ 'geosite.dat': 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download/geosite.dat' }));
  await expect(ensureGeo(withGeo)).resolves.toBe(true);
  expect(native.downloadGeo).not.toHaveBeenCalled();
});
