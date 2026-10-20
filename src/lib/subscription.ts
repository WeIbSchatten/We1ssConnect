import Constants from 'expo-constants';
import XrayVpn from 'xray-vpn';

import { t } from './i18n';
import { getState, newId, upsertProfile } from './store';
import type { Profile, Server, UserInfo, XrayOutbound } from './types';

/** Parses "upload=1; download=2; total=3; expire=4" (the subscription-userinfo header). */
export function parseUserInfo(header: string | null): UserInfo | undefined {
  if (!header) return undefined;
  const values: Record<string, number> = {};
  for (const part of header.split(';')) {
    const [k, v] = part.split('=').map((x) => x.trim());
    if (k && v && !Number.isNaN(Number(v))) values[k.toLowerCase()] = Number(v);
  }
  if (!('total' in values) && !('download' in values) && !('expire' in values)) return undefined;
  return {
    upload: values.upload ?? 0,
    download: values.download ?? 0,
    total: values.total ?? 0,
    expire: values.expire ?? 0,
  };
}

/** profile-title is plain text or "base64:<text>". */
export function parseTitle(header: string | null): string | undefined {
  if (!header) return undefined;
  const value = header.trim();
  if (!value.toLowerCase().startsWith('base64:')) return value || undefined;
  try {
    const bytes = Uint8Array.from(atob(value.slice(7)), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes) || undefined;
  } catch {
    return undefined;
  }
}

async function toServers(text: string, previous: Server[] = []): Promise<Server[]> {
  const json = JSON.parse(await XrayVpn.convertShareLinks(text)) as { outbounds?: XrayOutbound[] };
  const taken = new Set<string>();
  return (json.outbounds ?? []).map((outbound, i) => {
    const name = outbound.tag || `${outbound.protocol} ${i + 1}`;
    // Keep ids (and so the selection) of servers that are still there after a refresh.
    const id = previous.find((p) => p.name === name && !taken.has(p.id))?.id ?? newId();
    taken.add(id);
    return { id, name, outbound };
  });
}

export function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

export async function fetchSubscription(url: string, existing?: Profile): Promise<Profile> {
  const version = Constants.expoConfig?.version ?? '0';
  const res = await fetch(url.trim(), {
    headers: { 'User-Agent': `We1ssConnect/${version}`, Accept: '*/*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const servers = await toServers(body, existing?.servers);
  if (servers.length === 0) throw new Error('no servers in the subscription');
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return {
    id: existing?.id ?? newId(),
    name: parseTitle(res.headers.get('profile-title')) ?? existing?.name ?? host,
    url: url.trim(),
    updatedAt: Date.now(),
    userInfo: parseUserInfo(res.headers.get('subscription-userinfo')),
    servers,
  };
}

/** Adds a subscription URL or one or more share links; returns how many servers were added. */
export async function addFromText(text: string): Promise<number> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty');
  if (isUrl(trimmed) && !trimmed.includes('\n')) {
    const profile = await fetchSubscription(trimmed);
    upsertProfile(profile);
    return profile.servers.length;
  }
  const servers = await toServers(trimmed);
  if (servers.length === 0) throw new Error('no servers found');
  const manual = getState().profiles.find((p) => !p.url);
  upsertProfile({
    id: manual?.id ?? newId(),
    name: manual?.name ?? t('manualProfile'),
    updatedAt: Date.now(),
    servers: [...(manual?.servers ?? []), ...servers],
  });
  return servers.length;
}

export async function refreshAll(): Promise<void> {
  const errors: string[] = [];
  for (const profile of getState().profiles) {
    if (!profile.url) continue;
    try {
      upsertProfile(await fetchSubscription(profile.url, profile));
    } catch (e) {
      errors.push(`${profile.name}: ${(e as Error).message}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
