export interface XrayOutbound {
  protocol: string;
  tag?: string;
  settings?: Record<string, unknown>;
  streamSettings?: {
    security?: string;
    realitySettings?: { fingerprint?: string; [key: string]: unknown };
    tlsSettings?: { fingerprint?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Server {
  id: string;
  name: string;
  outbound: XrayOutbound;
  /** Last measured delay in ms; -1 when the server did not answer. */
  ping?: number;
}

export interface UserInfo {
  upload: number;
  download: number;
  total: number;
  /** Unix seconds; 0 when the subscription never expires. */
  expire: number;
}

export interface Profile {
  id: string;
  name: string;
  /** Subscription URL; absent for servers added from share links. */
  url?: string;
  updatedAt: number;
  userInfo?: UserInfo;
  servers: Server[];
}

export interface Settings {
  /**
   * Reality servers on Xray 26.9.8+ drop clients whose ClientHello lacks X25519MLKEM768,
   * which some fingerprints (ios, edge, android, random…) do not send; chrome does.
   */
  forceChromeFingerprint: boolean;
  /** Private networks (LAN, router) stay outside the tunnel. */
  bypassLan: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  forceChromeFingerprint: true,
  bypassLan: true,
};
