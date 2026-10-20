import { compareVersions } from './updater';

// jest hoists these above the import.
jest.mock('xray-vpn', () => ({}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

test('compares dotted versions', () => {
  expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
  expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
  expect(compareVersions('0.9.12', '1.0.0')).toBe(-1);
  expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
});
