import XrayVpn from 'xray-vpn';

import { t } from './i18n';
import { PortalError, request } from './portal';
import { getState, newId, upsertProfile } from './store';
import type { PortalAccount, Profile, Server, UserInfo, XrayOutbound } from './types';

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

const TELEGRAM = /^(tg:\/\/(proxy|socks)|https:\/\/t\.me\/(proxy|socks|webproxy))\?/i;

/** Telegram proxy links in a subscription body, which may be plain or base64 text. */
export function telegramLinks(body: string): string[] {
  let text = body.trim();
  if (!text.includes('://')) {
    try {
      const b64 = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      text = new TextDecoder().decode(bytes);
    } catch {
      return [];
    }
  }
  const links = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => TELEGRAM.test(line));
  return [...new Set(links)];
}

/** "Web Proxy" or "MTProto" with the server it points to. */
export function telegramLabel(link: string): { kind: string; server: string } {
  const query = new URLSearchParams(link.slice(link.indexOf('?') + 1));
  const server = query.get('server') ?? '';
  const port = query.get('port');
  if (/t\.me\/webproxy/i.test(link)) return { kind: 'Web Proxy', server };
  if (/socks/i.test(link)) return { kind: 'SOCKS5', server: port ? `${server}:${port}` : server };
  return { kind: 'MTProto', server: port ? `${server}:${port}` : server };
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

/** account (or existing.account) downloads a portal subscription with its device token. */
export async function fetchSubscription(url: string, existing?: Profile, account?: PortalAccount): Promise<Profile> {
  const acc = account ?? existing?.account;
  const headers: Record<string, string> = acc ? { Authorization: `Bearer ${acc.token}` } : {};
  const res = await request('GET', url.trim(), { headers });
  if (acc && res.status === 401) throw new PortalError('unauthorized');
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  const body = res.body;
  const servers = await toServers(body, existing?.servers);
  const telegram = telegramLinks(body);
  if (servers.length === 0 && telegram.length === 0) throw new Error('no servers in the subscription');
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return {
    id: existing?.id ?? newId(),
    // A name the user gave (or the first title) stays across refreshes.
    name: existing?.name ?? parseTitle(res.header('profile-title')) ?? (acc ? `${acc.login} @ ${host}` : host),
    url: url.trim(),
    updatedAt: Date.now(),
    userInfo: parseUserInfo(res.header('subscription-userinfo')),
    servers,
    telegram,
    ...(acc && { account: { base: acc.base, login: acc.login, token: acc.token } }),
  };
}

/** A refresh failure as the user should read it: a revoked token is "Login needed". */
export function refreshErrorText(err: unknown): string {
  if (err instanceof PortalError && err.code === 'unauthorized') return t('loginNeeded');
  return (err as Error).message;
}

// A login during the request replaced the token; that newer profile wins over this answer.
function stillCurrent(profile: Profile): Profile | undefined {
  const current = getState().profiles.find((p) => p.id === profile.id);
  return current && current.account?.token === profile.account?.token ? current : undefined;
}

async function refresh(profile: Profile): Promise<void> {
  try {
    const fresh = await fetchSubscription(profile.url!, profile);
    if (stillCurrent(profile)) upsertProfile(fresh);
  } catch (e) {
    const current = stillCurrent(profile);
    // A revoked device token keeps the old servers working and asks for a new login.
    if (current?.account && e instanceof PortalError && e.code === 'unauthorized') {
      upsertProfile({ ...current, account: { ...current.account, expired: true } });
    }
    throw e;
  }
}

/**
 * Adds a subscription URL, or share links as a group of their own; returns how many servers were added.
 * name labels the group (a subscription's own title is used when it has one).
 */
export async function addFromText(text: string, name?: string): Promise<number> {
  const trimmed = text.trim();
  const label = name?.trim();
  if (!trimmed) throw new Error('empty');
  if (isUrl(trimmed) && !trimmed.includes('\n')) {
    const existing = getState().profiles.find((p) => p.url === trimmed);
    const profile = await fetchSubscription(trimmed, existing);
    upsertProfile(label ? { ...profile, name: label } : profile);
    return profile.servers.length;
  }
  const servers = await toServers(trimmed);
  if (servers.length === 0) throw new Error('no servers found');
  const groups = getState().profiles.filter((p) => !p.url).length;
  upsertProfile({
    id: newId(),
    name: label || t('keysGroup', { n: groups + 1 }),
    updatedAt: Date.now(),
    servers,
  });
  return servers.length;
}

/** Re-downloads one subscription. */
export async function refreshProfile(id: string): Promise<void> {
  const profile = getState().profiles.find((p) => p.id === id);
  if (!profile?.url) return;
  await refresh(profile);
}

export async function refreshAll(): Promise<void> {
  const errors: string[] = [];
  for (const profile of getState().profiles) {
    if (!profile.url) continue;
    try {
      await refresh(profile);
    } catch (e) {
      errors.push(`${profile.name}: ${refreshErrorText(e)}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
}

const STALE_MS = 12 * 3600_000;

/** Quietly refreshes subscriptions not updated for 12 hours. */
export async function refreshStale(): Promise<void> {
  for (const profile of getState().profiles) {
    if (!profile.url || Date.now() - profile.updatedAt < STALE_MS) continue;
    try {
      await refresh(profile);
    } catch {
      // Tried again on the next start; the old servers keep working.
    }
  }
}

/** A server as a share link (vless://…), for copying or a QR code. */
export async function shareLink(server: Server): Promise<string> {
  const outbound = { ...server.outbound, tag: server.name };
  const links = await XrayVpn.shareLinks(JSON.stringify({ outbounds: [outbound] }));
  const link = links.split('\n').find((l) => l.trim());
  if (!link) throw new Error('no link');
  return link.trim();
}
