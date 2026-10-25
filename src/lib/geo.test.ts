import XrayVpn from 'xray-vpn';

import { ensureGeo, GEO_FILES } from './geo';
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
