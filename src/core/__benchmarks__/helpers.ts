/** Shared fixtures for LCS benchmarks. */

export function benchLines(n: number, mutateEvery = 0): string[] {
  return Array.from({ length: n }, (_unused, i) => {
    if (mutateEvery > 0 && i % mutateEvery === 0) {
      return `line-${i}-changed`;
    }
    return `line-${i}`;
  });
}