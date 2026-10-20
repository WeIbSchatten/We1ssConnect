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
  installedApps(): Promise<InstalledApp[]>;
  appIcon(packageName: string): Promise<string | null>;
  getItem(key: string): string | null;
  setItem(key: string, value: string | null): void;
  addListener(event: 'onStatus', listener: (status: VpnStatus) => void): EventSubscription;
}

const XrayVpn = requireNativeModule<XrayVpnNative>('XrayVpn');

export default XrayVpn;
