import { requireNativeModule, type EventSubscription } from 'expo';

export type VpnState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VpnStatus {
  state: VpnState;
  error: string | null;
}

export type AppMode = 'all' | 'include' | 'exclude';

export interface InstalledApp {
  id: string;
  name: string;
  system: boolean;
}

interface XrayVpnNative {
  status(): VpnStatus;
  xrayVersion(): Promise<string>;
  convertShareLinks(text: string): Promise<string>;
  /** Delays while the VPN is off (libXray starts its own short-lived instance). */
  ping(configs: string[], url: string, timeoutSeconds: number): Promise<number[]>;
  prepare(): Promise<boolean>;
  start(config: string, title: string, target: string, appMode: AppMode, apps: string[]): void;
  stop(): void;
  /** Running instance only: JSON [{tag, alive, delay, error}]. */
  observation(): Promise<string>;
  /** Running instance only: the server outbound the balancer uses now. */
  balancerTarget(): Promise<string>;
  /** Running instance only: pins a server outbound; "" goes back to automatic. */
  setTarget(target: string): Promise<void>;
  /** Running instance only: JSON {up, down} in bytes. */
  traffic(): Promise<string>;
  /** Running instance only: GET through the tunnel. */
  httpGet(url: string, timeoutMs: number): Promise<string>;
  delay(url: string, outboundTag: string, timeoutMs: number): Promise<number>;
  /** JSON [{host, port, udp}] → delay to each server's address in ms, -1 when unreachable. */
  serverPing(targetsJson: string, timeoutMs: number): Promise<number[]>;
  /** Xray JSON with outbounds → share links, one per line. */
  shareLinks(xrayJson: string): Promise<string>;
  /** Downloads file name → URL into the rule file folder; resolves with geoUpdatedAt(). */
  downloadGeo(files: Record<string, string>): Promise<number>;
  /** When geoip.dat and geosite.dat were saved (ms), or 0 when either is missing. */
  geoUpdatedAt(): number;
  installedApps(): Promise<InstalledApp[]>;
  appIcon(packageName: string): Promise<string | null>;
  getItem(key: string): string | null;
  setItem(key: string, value: string | null): void;
  /** The device's preferred ABI, such as arm64-v8a. */
  abi(): string;
  /** Downloads the APK and opens the system installer; progress arrives as onDownload. */
  installUpdate(url: string): Promise<void>;
  addListener(event: 'onStatus', listener: (status: VpnStatus) => void): EventSubscription;
  addListener(event: 'onDownload', listener: (p: { done: number; total: number }) => void): EventSubscription;
}

const XrayVpn = requireNativeModule<XrayVpnNative>('XrayVpn');

export default XrayVpn;
