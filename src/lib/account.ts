import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { t } from './i18n';
import { PortalError, portalBase, portalErrorFrom, request } from './portal';
import { getState, removeProfile, upsertProfile } from './store';
import { fetchSubscription } from './subscription';
import type { Profile } from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Logs in to the panel's client portal and saves its subscription as a profile; the password is
 * sent once and never stored. Logging in again with the same server and login refreshes that profile.
 */
export async function loginToPortal(address: string, login: string, password: string): Promise<Profile> {
  let base = portalBase(address);
  const body = JSON.stringify({
    login: login.trim(),
    password,
    client: 'app',
    device: deviceLabel(Constants.deviceName, Platform.OS),
  });
  const post = (root: string) => request('POST', `${root}/portal/api/login`, { headers: JSON_HEADERS, body });
  let res = await post(base);
  // A pasted subscription link carries the subscription path; the portal sits at the server root.
  const origin = new URL(base).origin;
  if (res.status === 404 && origin !== base) {
    base = origin;
    res = await post(base);
  }
  if (res.status !== 200) throw portalErrorFrom(res);
  const { token } = JSON.parse(res.body) as { token: string };

  const existing = getState().profiles.find(
    (p) => p.account?.base === base && p.account.login.toLowerCase() === login.trim().toLowerCase(),
  );
  const account = { base, login: existing?.account?.login ?? login.trim(), token };
  const profile = await fetchSubscription(`${base}/portal/api/sub`, existing, account);
  upsertProfile(profile);
  if (existing?.account && existing.account.token !== token) void signOut(existing.account);
  return profile;
}

// The server caps device names at 64 bytes; a longer UTF-8 name would fail the whole login.
export function deviceLabel(name: string | null | undefined, os: string): string {
  const label = name || (os === 'web' ? 'We1ssConnect desktop' : os);
  const bytes = new TextEncoder();
  let out = '';
  for (const ch of label) {
    if (bytes.encode(out + ch).length > 64) break;
    out += ch;
  }
  return out;
}

function signOut(account: { base: string; token: string }): Promise<unknown> {
  return request('POST', `${account.base}/portal/api/logout`, {
    headers: { Authorization: `Bearer ${account.token}` },
  }).catch(() => undefined);
}

/** Removes an account profile and signs its device out; an unreachable server does not block it. */
export async function removeAccount(id: string): Promise<void> {
  const profile = getState().profiles.find((p) => p.id === id);
  removeProfile(id);
  if (profile?.account) await signOut(profile.account);
}

/** A message for a failed portal login; base fills in where the user sets a temporary password. */
export function portalErrorText(err: unknown, base: string): string {
  if (!(err instanceof PortalError)) return (err as Error).message;
  switch (err.code) {
    case 'invalid_credentials':
      return t('loginInvalid');
    case 'too_many_attempts':
      return t('loginTooMany', { s: err.retryAfter ?? 60 });
    case 'must_change_password':
      return t('loginMustChange', { url: `${base}/portal` });
    case 'portal_off':
      return t('portalOff');
    default:
      return t('loginFailed', { code: err.code });
  }
}
