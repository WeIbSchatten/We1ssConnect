import { isUrl, parseTitle, parseUserInfo, telegramLabel, telegramLinks } from './subscription';

jest.mock('xray-vpn', () => ({ __esModule: true, default: { getItem: () => null, setItem: () => undefined } }));

test('parses subscription-userinfo', () => {
  expect(parseUserInfo('upload=10; download=20; total=1000; expire=1790000000')).toEqual({
    upload: 10,
    download: 20,
    total: 1000,
    expire: 1790000000,
  });
  expect(parseUserInfo(null)).toBeUndefined();
  expect(parseUserInfo('garbage')).toBeUndefined();
});

test('parses profile-title in plain and base64 form', () => {
  expect(parseTitle('My VPN')).toBe('My VPN');
  expect(parseTitle('base64:0JzQvtC5IFZQTg==')).toBe('Мой VPN');
});

test('tells subscription URLs from share links', () => {
  expect(isUrl('https://sub.example.com/abc')).toBe(true);
  expect(isUrl('vless://x@y:443')).toBe(false);
});

describe('telegramLinks', () => {
  const links = [
    'vless://id@1.2.3.4:443#a',
    'tg://proxy?server=mt.example.com&port=8443&secret=ee00',
    'https://t.me/webproxy?server=proxy.example.com&secret=abc',
  ].join('\n');

  it('finds MTProto and Web Proxy links in plain text', () => {
    expect(telegramLinks(links)).toEqual([
      'tg://proxy?server=mt.example.com&port=8443&secret=ee00',
      'https://t.me/webproxy?server=proxy.example.com&secret=abc',
    ]);
  });

  it('decodes base64 subscriptions', () => {
    expect(telegramLinks(Buffer.from(links).toString('base64'))).toHaveLength(2);
  });

  it('labels them', () => {
    expect(telegramLabel('tg://proxy?server=mt.example.com&port=8443&secret=ee00')).toEqual({
      kind: 'MTProto',
      server: 'mt.example.com:8443',
    });
    expect(telegramLabel('https://t.me/webproxy?server=proxy.example.com&secret=abc')).toEqual({
      kind: 'Web Proxy',
      server: 'proxy.example.com',
    });
  });
});
