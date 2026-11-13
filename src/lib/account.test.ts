import { loginToPortal, removeAccount } from './account';
import { PortalError } from './portal';
import { getState, removeProfile, selectServer } from './store';
import { refreshProfile, refreshStale } from './subscription';

jest.mock('xray-vpn', () => ({
  __esModule: true,
  default: {
    getItem: () => null,
    setItem: () => undefined,
    convertShareLinks: async (text: string) =>
      JSON.stringify({
        outbounds: text
          .split('\n')
          .filter(Boolean)
          .map((line) => ({ protocol: line.split('://')[0], tag: line.split('#')[1] })),
      }),
  },
}));

const BASE = 'https://vpn.example.com:2096';
const SUB = 'vless://a@h:443#Finland\ntrojan://p@h:443#Netherlands';

function reply(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  for (const p of getState().profiles) removeProfile(p.id);
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

function loginOk(token = 't1', sub = SUB) {
  fetchMock
    .mockResolvedValueOnce(reply(200, JSON.stringify({ token })))
    .mockResolvedValueOnce(reply(200, sub, { 'subscription-userinfo': 'upload=1; download=2; total=0; expire=0' }));
}

test('logs in as an app, then downloads the subscription with the device token', async () => {
  loginOk();
  const profile = await loginToPortal('vpn.example.com:2096/portal', 'a.smirnova', 'secret-pass');

  const [loginUrl, loginInit] = fetchMock.mock.calls[0];
  expect(loginUrl).toBe(`${BASE}/portal/api/login`);
  expect(loginInit.method).toBe('POST');
  expect(JSON.parse(loginInit.body)).toMatchObject({ login: 'a.smirnova', password: 'secret-pass', client: 'app' });
  expect(JSON.parse(loginInit.body).device).toBeTruthy();
  const [subUrl, subInit] = fetchMock.mock.calls[1];
  expect(subUrl).toBe(`${BASE}/portal/api/sub`);
  expect(new Headers(subInit.headers).get('Authorization')).toBe('Bearer t1');

  expect(profile.account).toEqual({ base: BASE, login: 'a.smirnova', token: 't1' });
  expect(profile.servers.map((s) => s.name)).toEqual(['Finland', 'Netherlands']);
  expect(JSON.stringify(getState())).not.toContain('secret-pass');
});

test.each([
  [401, { error: 'invalid_credentials' }, {}, 'invalid_credentials', undefined],
  [429, { error: 'too_many_attempts' }, { 'Retry-After': '30' }, 'too_many_attempts', 30],
  [403, { error: 'must_change_password' }, {}, 'must_change_password', undefined],
  [404, {}, {}, 'portal_off', undefined],
])('login answered %i becomes PortalError %s', async (status, body, headers, code, retryAfter) => {
  fetchMock.mockResolvedValueOnce(reply(status, JSON.stringify(body), headers));
  const err = await loginToPortal(BASE, 'a.smirnova', 'x').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(PortalError);
  expect(err).toMatchObject({ code, retryAfter });
  expect(getState().profiles).toHaveLength(0);
});

test('logging in again reuses the profile and keeps the chosen server', async () => {
  loginOk('t1');
  const first = await loginToPortal(BASE, 'a.smirnova', 'pw-1');
  selectServer(first.servers[1].id);
  loginOk('t2');
  const second = await loginToPortal(`${BASE}/`, 'A.Smirnova', 'pw-2');

  expect(getState().profiles).toHaveLength(1);
  expect(second.id).toBe(first.id);
  expect(second.account?.token).toBe('t2');
  expect(getState().selectedId).toBe(first.servers[1].id);
});

test('a revoked token marks the profile as needing a login and keeps its servers', async () => {
  loginOk();
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  fetchMock.mockResolvedValueOnce(reply(401, JSON.stringify({ error: 'unauthorized' })));

  await expect(refreshProfile(profile.id)).rejects.toMatchObject({ code: 'unauthorized' });
  const after = getState().profiles[0];
  expect(after.account?.expired).toBe(true);
  expect(after.servers.map((s) => s.name)).toEqual(['Finland', 'Netherlands']);
});

test('a network failure does not mark the profile as needing a login', async () => {
  loginOk();
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(refreshProfile(profile.id)).rejects.toThrow('Network request failed');
  expect(getState().profiles[0].account?.expired).toBeUndefined();
});

test('a quiet stale refresh also marks a revoked token', async () => {
  loginOk();
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  jest.spyOn(Date, 'now').mockReturnValue(profile.updatedAt + 13 * 3600_000);
  fetchMock.mockResolvedValueOnce(reply(401, JSON.stringify({ error: 'unauthorized' })));
  await refreshStale();
  expect(getState().profiles[0].account?.expired).toBe(true);
});

test('removing an account profile signs the device out and survives an unreachable server', async () => {
  loginOk();
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await removeAccount(profile.id);

  const [url, init] = fetchMock.mock.calls[2];
  expect(url).toBe(`${BASE}/portal/api/logout`);
  expect(init.method).toBe('POST');
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer t1');
  expect(getState().profiles).toHaveLength(0);
});
