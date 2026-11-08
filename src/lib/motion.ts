/** Seconds per orbit of the connect button's satellites: idle drifts, a busy tunnel visibly spins. */
export function orbitSeconds(bytesPerSecond: number): number {
  const mbit = (bytesPerSecond * 8) / 1e6;
  return Math.max(1.6, 14 / (1 + Math.log2(1 + mbit)));
}
