import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { portalBase, portalErrorFrom, request } from './portal';
import { getState, removeProfile, upsertProfile } from './store';
import { fetchSubscription } from './subscription';
import type { Profile } from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Logs in to the panel's client portal and saves its subscription as a profile; the password is
 * sent once and never stored. Logging in again with the same server and login refreshes that profile.
 */
export async function loginToPortal(address: string, login: string, password: string): Promise<Profile> {
  const base = portalBase(address);
  const device = Constants.deviceName || Platform.OS;
  const res = await request('POST', `${base}/portal/api/login`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ login: login.trim(), password, client: 'app', device }),
  });
  if (res.status !== 200) throw portalErrorFrom(res);
  const { token } = JSON.parse(res.body) as { token: string };

  const existing = getState().profiles.find(
    (p) => p.account?.base === base && p.account.login.toLowerCase() === login.trim().toLowerCase(),
  );
  const account = { base, login: existing?.account?.login ?? login.trim(), token };
  const profile = await fetchSubscription(`${base}/portal/api/sub`, existing, account);
  upsertProfile(profile);
  return profile;
}

/** Removes an account profile and signs its device out; an unreachable server does not block it. */
export async function removeAccount(id: string): Promise<void> {
  const profile = getState().profiles.find((p) => p.id === id);
  removeProfile(id);
  if (!profile?.account) return;
  await request('POST', `${profile.account.base}/portal/api/logout`, {
    headers: { Authorization: `Bearer ${profile.account.token}` },
  }).catch(() => undefined);
}
