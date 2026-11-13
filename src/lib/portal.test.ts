import { portalBase, request } from './portal';

jest.mock('xray-vpn', () => ({ __esModule: true, default: { getItem: () => null, setItem: () => undefined } }));

describe('portalBase', () => {
  test.each([
    ['vpn.example.com:2096', 'https://vpn.example.com:2096'],
    ['https://vpn.example.com:2096/', 'https://vpn.example.com:2096'],
    ['https://vpn.example.com:2096/portal', 'https://vpn.example.com:2096'],
    ['  https://vpn.example.com:2096/portal/  ', 'https://vpn.example.com:2096'],
    ['http://10.0.0.1:2096', 'http://10.0.0.1:2096'],
    ['https://vpn.example.com/vpn/portal', 'https://vpn.example.com/vpn'],
  ])('%s → %s', (input, want) => {
    expect(portalBase(input)).toBe(want);
  });

  test('rejects an empty address', () => {
    expect(() => portalBase('   ')).toThrow();
  });
});

describe('request', () => {
  afterEach(() => jest.restoreAllMocks());

  test('sends the method, headers and body and exposes response headers by lower-case name', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"error":"too_many_attempts"}', { status: 429, headers: { 'Retry-After': '30' } }),
    );
    const res = await request('POST', 'https://vpn.example.com/portal/api/login', {
      headers: { Authorization: 'Bearer t1' },
      body: '{"login":"a"}',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://vpn.example.com/portal/api/login');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"login":"a"}');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer t1');
    expect(res.status).toBe(429);
    expect(res.header('retry-after')).toBe('30');
    expect(res.body).toBe('{"error":"too_many_attempts"}');
  });
});
