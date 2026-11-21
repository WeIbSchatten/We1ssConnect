/** Seconds per orbit of the connect button's satellites: idle drifts, a busy tunnel visibly spins. */
export function orbitSeconds(bytesPerSecond: number): number {
  const mbit = (bytesPerSecond * 8) / 1e6;
  return Math.max(1.6, 14 / (1 + Math.log2(1 + mbit)));
}

/** The connect button's planets, inner to outer: ring radius (px), relative distance, dot size, start angle. */
export const PLANETS = [
  { radius: 92, distance: 1, size: 7, phase: 30 },
  { radius: 103, distance: 1.6, size: 9, phase: 200 },
  { radius: 114, distance: 2.4, size: 5, phase: 310 },
] as const;

/** Seconds per lap of each planet when the inner one takes `inner`: T grows as distance^1.5. */
export function planetSeconds(inner: number): number[] {
  return PLANETS.map((p) => Math.round(inner * p.distance ** 1.5 * 10) / 10);
}
