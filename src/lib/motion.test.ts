import { orbitSeconds } from './motion';

// The satellites must read as "busier" with more traffic, and never spin into a blur.
test('the orbit speeds up with traffic and stays readable', () => {
  const idle = orbitSeconds(0);
  const browsing = orbitSeconds(250_000);
  const streaming = orbitSeconds(5_000_000);
  expect(idle).toBe(14);
  expect(browsing).toBeLessThan(idle);
  expect(streaming).toBeLessThan(browsing);
  expect(orbitSeconds(1e10)).toBe(1.6);
});
