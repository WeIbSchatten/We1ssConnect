import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import XrayVpn from 'xray-vpn';

/** Releases of the app on GitHub; the APK for each ABI is attached to them. */
export const REPO = 'WeIbSchatten/We1ssConnect';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface Update {
  version: string;
  notes: string;
  url: string;
  size: number;
  page: string;
}

interface State {
  checking: boolean;
  checkedAt: number;
  update?: Update;
  error?: string;
  /** 0..1 while downloading. */
  progress?: number;
}

let state: State = { checking: false, checkedAt: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useUpdater(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** -1, 0 or 1 for dotted versions such as 1.0.0 and 1.0.12. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

interface Release {
  tag_name: string;
  body?: string;
  html_url: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

/** Looks for a newer release with an APK for this device. */
export async function checkForUpdate(): Promise<Update | undefined> {
  if (state.checking) return state.update;
  set({ checking: true, error: undefined });
  try {
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const release = (await res.json()) as Release;
    const version = release.tag_name.replace(/^v/, '');
    let update: Update | undefined;
    if (compareVersions(version, currentVersion()) > 0) {
      const abi = XrayVpn.abi();
      // Desktop builds report the whole asset suffix (windows-amd64-setup.exe, linux-amd64).
      const asset =
        Platform.OS === 'web'
          ? release.assets.find((a) => a.name.endsWith(`-${abi}`))
          : (release.assets.find((a) => a.name.endsWith(`-${abi}.apk`)) ??
            release.assets.find((a) => a.name.endsWith('-arm64-v8a.apk')));
      if (asset) {
        update = {
          version,
          notes: release.body ?? '',
          url: asset.browser_download_url,
          size: asset.size,
          page: release.html_url,
        };
      }
    }
    set({ update, checkedAt: Date.now() });
    return update;
  } catch (e) {
    set({ error: (e as Error).message, checkedAt: Date.now() });
    throw e;
  } finally {
    set({ checking: false });
  }
}

/** Checks once in a while on its own, quietly. */
export function autoCheck(): void {
  if (Date.now() - state.checkedAt < 6 * 3600_000) return;
  checkForUpdate().catch(() => undefined);
}

export async function installUpdate(update: Update): Promise<void> {
  const sub = XrayVpn.addListener('onDownload', ({ done, total }) =>
    set({ progress: total > 0 ? done / total : undefined }),
  );
  set({ progress: 0 });
  try {
    await XrayVpn.installUpdate(update.url);
  } finally {
    sub.remove();
    set({ progress: undefined });
  }
}
