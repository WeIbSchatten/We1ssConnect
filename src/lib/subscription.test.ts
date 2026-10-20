import { isUrl, parseTitle, parseUserInfo } from './subscription';

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
