import { requireNativeModule, type EventSubscription } from 'expo';

export type VpnState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VpnStatus {
  state: VpnState;
  error: string | null;
}

interface XrayVpnNative {
  status(): VpnStatus;
  xrayVersion(): Promise<string>;
  convertShareLinks(text: string): Promise<string>;
  ping(configs: string[], url: string, timeoutSeconds: number): Promise<number[]>;
  prepare(): Promise<boolean>;
  start(config: string, title: string): void;
  stop(): void;
  getItem(key: string): string | null;
  setItem(key: string, value: string | null): void;
  addListener(event: 'onStatus', listener: (status: VpnStatus) => void): EventSubscription;
}

const XrayVpn = requireNativeModule<XrayVpnNative>('XrayVpn');

export default XrayVpn;
