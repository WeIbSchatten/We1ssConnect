import { deviceLabel, loginToPortal, portalErrorText, removeAccount } from './account';
import { PortalError } from './portal';
import { getState, removeProfile, selectServer } from './store';
import { refreshErrorText, refreshProfile, refreshStale } from './subscription';

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
  return new Response(status === 204 ? null : body, { status, headers });
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

describe('portalErrorText', () => {
  test.each([
    [new PortalError('invalid_credentials'), 'Неверный логин или пароль'],
    [new PortalError('too_many_attempts', 30), 'Слишком много попыток. Повторите через 30 с.'],
    [new PortalError('must_change_password'), `Пароль временный. Задайте свой на ${BASE}/portal, затем войдите здесь.`],
    [new PortalError('portal_off'), 'Личный кабинет на этом сервере выключен.'],
    [new PortalError('http_502'), 'Не удалось войти: http_502'],
    [new TypeError('Network request failed'), 'Network request failed'],
  ])('%s', (err, text) => {
    expect(portalErrorText(err, BASE)).toBe(text);
  });
});

test('a pasted subscription link falls back to the server root', async () => {
  fetchMock
    .mockResolvedValueOnce(reply(404, '404 page not found'))
    .mockResolvedValueOnce(reply(200, JSON.stringify({ token: 't1' })))
    .mockResolvedValueOnce(reply(200, SUB));
  const profile = await loginToPortal(`${BASE}/sub/abc123`, 'a.smirnova', 'pw');
  expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/sub/abc123/portal/api/login`);
  expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/portal/api/login`);
  expect(profile.account?.base).toBe(BASE);
});

test('logging in again signs the previous token out', async () => {
  loginOk('t1');
  await loginToPortal(BASE, 'a.smirnova', 'pw');
  loginOk('t2');
  fetchMock.mockResolvedValueOnce(reply(204, ''));
  await loginToPortal(BASE, 'a.smirnova', 'pw');
  const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/portal/api/logout'));
  expect(logout).toBeDefined();
  expect(new Headers(logout![1].headers).get('Authorization')).toBe('Bearer t1');
});

test('a late 401 for an old token does not undo a fresh login', async () => {
  loginOk('t1');
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  let answer!: (r: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (answer = resolve)));
  const stale = refreshProfile(profile.id).catch(() => undefined);
  loginOk('t2');
  fetchMock.mockResolvedValueOnce(reply(204, ''));
  await loginToPortal(BASE, 'a.smirnova', 'pw');
  answer(reply(401, JSON.stringify({ error: 'unauthorized' })));
  await stale;
  expect(getState().profiles[0].account?.token).toBe('t2');
  expect(getState().profiles[0].account?.expired).toBeUndefined();
});

test('a server error during refresh does not mark the profile as needing a login', async () => {
  loginOk();
  const profile = await loginToPortal(BASE, 'a.smirnova', 'pw');
  fetchMock.mockResolvedValueOnce(reply(502, 'bad gateway'));
  await expect(refreshProfile(profile.id)).rejects.toThrow('HTTP 502');
  expect(getState().profiles[0].account?.expired).toBeUndefined();
});

test('device names fit the server limit of 64 bytes', () => {
  const long = 'Планшет Анастасии Сергеевны для работы и поездок';
  const label = deviceLabel(long, 'android');
  expect(new TextEncoder().encode(label).length).toBeLessThanOrEqual(64);
  expect(long.startsWith(label)).toBe(true);
  expect(deviceLabel(undefined, 'web')).toBe('We1ssConnect desktop');
});

test('a revoked token reads as Login needed, not the raw code', () => {
  expect(refreshErrorText(new PortalError('unauthorized'))).toBe('Требуется вход');
  expect(refreshErrorText(new Error('HTTP 502'))).toBe('HTTP 502');
});
