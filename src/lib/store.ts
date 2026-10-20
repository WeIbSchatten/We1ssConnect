import { useSyncExternalStore } from 'react';
import XrayVpn from 'xray-vpn';

import { DEFAULT_SETTINGS, type Profile, type Server, type Settings } from './types';

interface State {
  profiles: Profile[];
  selectedId: string | null;
  settings: Settings;
}

const KEY = 'state.v1';

function load(): State {
  try {
    const raw = XrayVpn.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      return {
        profiles: saved.profiles ?? [],
        selectedId: saved.selectedId ?? null,
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      };
    }
  } catch {
    // A broken store starts over rather than crashing the app.
  }
  return { profiles: [], selectedId: null, settings: DEFAULT_SETTINGS };
}

let state: State = load();
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  XrayVpn.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function allServers(s: State = state): Server[] {
  return s.profiles.flatMap((p) => p.servers);
}

export function selectedServer(s: State = state): Server | undefined {
  const servers = allServers(s);
  return servers.find((x) => x.id === s.selectedId) ?? servers[0];
}

export function selectServer(id: string) {
  update({ selectedId: id });
}

export function upsertProfile(profile: Profile) {
  const exists = state.profiles.some((p) => p.id === profile.id);
  const profiles = exists
    ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
    : [...state.profiles, profile];
  const selectedId = state.selectedId ?? profile.servers[0]?.id ?? null;
  update({ profiles, selectedId });
}

export function removeProfile(id: string) {
  update({ profiles: state.profiles.filter((p) => p.id !== id) });
}

export function setPings(pings: Record<string, number>) {
  update({
    profiles: state.profiles.map((p) => ({
      ...p,
      servers: p.servers.map((s) => (s.id in pings ? { ...s, ping: pings[s.id] } : s)),
    })),
  });
}

export function updateSettings(patch: Partial<Settings>) {
  update({ settings: { ...state.settings, ...patch } });
}
