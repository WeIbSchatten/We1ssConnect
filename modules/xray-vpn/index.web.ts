// Desktop build: the same API as the Android module, served by the Wails shell (desktop/).
// window.go.main.App is injected by Wails; every call goes to desktop/app.go.
import type { AppMode, InstalledApp, VpnStatus } from './index';

export type { AppMode, InstalledApp, VpnState, VpnStatus } from './index';

type Listener = (payload: never) => void;

interface Bridge {
  Status(): Promise<VpnStatus>;
  XrayVersion(): Promise<string>;
  ConvertShareLinks(text: string): Promise<string>;
  ShareLinks(json: string): Promise<string>;
  Ping(configs: string[], url: string, timeoutSeconds: number): Promise<number[]>;
  ServerPing(targetsJson: string, timeoutMs: number): Promise<number[]>;
  Start(config: string, title: string, target: string): Promise<void>;
  Stop(): Promise<void>;
  Observation(): Promise<string>;
  BalancerTarget(): Promise<string>;
  SetTarget(target: string): Promise<void>;
  Traffic(): Promise<string>;
  HTTPGet(url: string, timeoutMs: number): Promise<string>;
  Fetch(url: string, userAgent: string): Promise<{ status: number; body: string; headers: Record<string, string> }>;
  DownloadGeo(files: Record<string, string>): Promise<number>;
  GeoUpdatedAt(): Promise<number>;
  InstallUpdate(url: string): Promise<void>;
  LoadStore(): Promise<Record<string, string>>;
  SaveItem(key: string, value: string | null): Promise<void>;
  Platform(): Promise<string>;
  OpenURL(url: string): Promise<void>;
}

declare global {
  interface Window {
    go?: { main?: { App?: Bridge } };
    runtime?: { EventsOn(name: string, cb: (...args: unknown[]) => void): () => void };
  }
}

function bridge(): Bridge {
  const app = window.go?.main?.App;
  if (!app) throw new Error('We1ssConnect desktop bridge is not available');
  return app;
}

// Values the Android module answers synchronously are cached here and kept fresh.
let status: VpnStatus = { state: 'disconnected', error: null };
let geoAt = 0;
// desktop/assets.go inlines the saved state into index.html, so reads can stay synchronous.
const injected = (window as unknown as { __WE1SS__?: { store: Record<string, string>; platform: string } }).__WE1SS__;
let items: Record<string, string> = injected?.store ?? {};
const platform = injected?.platform ?? 'linux-amd64';
const listeners: Record<string, Set<Listener>> = { onStatus: new Set(), onDownload: new Set() };

window.runtime?.EventsOn('status', (s) => {
  status = s as VpnStatus;
  listeners.onStatus.forEach((l) => l(status as never));
});
window.runtime?.EventsOn('download', (p) => listeners.onDownload.forEach((l) => l(p as never)));
void window.go?.main?.App?.GeoUpdatedAt().then((v) => (geoAt = v));

const XrayVpn = {
  status: () => status,
  xrayVersion: () => bridge().XrayVersion(),
  convertShareLinks: (text: string) => bridge().ConvertShareLinks(text),
  shareLinks: (json: string) => bridge().ShareLinks(json),
  ping: (configs: string[], url: string, timeoutSeconds: number) => bridge().Ping(configs, url, timeoutSeconds),
  serverPing: (targetsJson: string, timeoutMs: number) => bridge().ServerPing(targetsJson, timeoutMs),
  // The desktop runs Xray as a local proxy and switches the system proxy on; no VPN permission.
  prepare: async () => true,
  start: (config: string, title: string, target: string, _mode: AppMode, _apps: string[]) => {
    status = { state: 'connecting', error: null };
    void bridge().Start(config, title, target);
  },
  stop: () => void bridge().Stop(),
  observation: () => bridge().Observation(),
  balancerTarget: () => bridge().BalancerTarget(),
  setTarget: (target: string) => bridge().SetTarget(target),
  traffic: () => bridge().Traffic(),
  httpGet: (url: string, timeoutMs: number) => bridge().HTTPGet(url, timeoutMs),
  fetch: (url: string, userAgent: string) => bridge().Fetch(url, userAgent),
  openUrl: (url: string) => bridge().OpenURL(url),
  delay: async () => -1,
  downloadGeo: async (files: Record<string, string>) => (geoAt = await bridge().DownloadGeo(files)),
  geoUpdatedAt: () => geoAt,
  // The release asset suffix for this OS, like the ABI on Android (see src/lib/updater.ts).
  abi: () => (platform.startsWith('windows') ? `${platform}-setup.exe` : platform),
  installUpdate: (url: string) => bridge().InstallUpdate(url),
  installedApps: async (): Promise<InstalledApp[]> => [],
  appIcon: async () => null,
  getItem: (key: string) => items[key] ?? null,
  setItem: (key: string, value: string | null) => {
    if (value === null) delete items[key];
    else items[key] = value;
    void bridge().SaveItem(key, value);
  },
  addListener: (event: 'onStatus' | 'onDownload', listener: Listener) => {
    listeners[event].add(listener);
    return { remove: () => listeners[event].delete(listener) };
  },
};

export default XrayVpn;
