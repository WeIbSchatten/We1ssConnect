import { describeEntries, parseEntries, usesGeo } from './rules';

test('categories, prefixed and plain domains, addresses and subnets', () => {
  expect(
    parseEntries([
      'geosite:ru-blocked',
      'GeoSite:YouTube',
      'geoip:telegram',
      'domain:example.com',
      'full:www.example.org',
      'keyword:tracker',
      'regexp:^ads\\.',
      'Example.NET',
      '*.cdn.example',
      '1.2.3.4',
      '10.0.0.0/8',
      '2001:db8::/32',
      '',
      '# a comment',
    ]),
  ).toEqual({
    domain: [
      'geosite:ru-blocked',
      'geosite:youtube',
      'domain:example.com',
      'full:www.example.org',
      'keyword:tracker',
      'regexp:^ads\\.',
      'domain:example.net',
      'domain:cdn.example',
    ],
    ip: ['geoip:telegram', '1.2.3.4', '10.0.0.0/8', '2001:db8::/32'],
    invalid: [],
  });
});

test('broken entries are reported, not passed to Xray', () => {
  expect(parseEntries(['geosite:', 'geoip:google@cn', 'not a domain', 'geosite:a b', '999.1.1.1']).invalid).toEqual([
    'geosite:',
    'geoip:google@cn',
    'not a domain',
    'geosite:a b',
    '999.1.1.1',
  ]);
});

test('only geosite:/geoip: entries need the rule files', () => {
  expect(usesGeo({ proxy: ['example.com'], direct: ['10.0.0.0/8'], block: [] })).toBe(false);
  expect(usesGeo({ proxy: [], direct: ['geoip:ru'], block: [] })).toBe(true);
  expect(usesGeo({ proxy: [], direct: [], block: ['GEOSITE:category-ads-all'] })).toBe(true);
});

test('a short summary of a list', () => {
  expect(describeEntries([])).toBe('');
  expect(describeEntries(['geosite:youtube', 'example.com'])).toBe('geosite:youtube, example.com');
  expect(describeEntries(['a.com', 'b.com', 'c.com', 'd.com'])).toBe('a.com, b.com, c.com +1');
});
