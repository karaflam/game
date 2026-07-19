export function pickRandomItem<T>(items: readonly T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length)];
}

export function pickRandomIndexExcluding(
  length: number,
  excluded: ReadonlySet<number>,
  random: () => number = Math.random
): number {
  const all = Array.from({ length }, (_, i) => i);
  const available = all.filter(i => !excluded.has(i));
  const pool = available.length > 0 ? available : all;
  return pool[Math.floor(random() * pool.length)];
}

export function pickRandomIndexFromCandidates(
  candidates: readonly number[],
  excluded: ReadonlySet<number>,
  random: () => number = Math.random
): number {
  const available = candidates.filter(i => !excluded.has(i));
  const pool = available.length > 0 ? available : candidates;
  return pool[Math.floor(random() * pool.length)];
}
