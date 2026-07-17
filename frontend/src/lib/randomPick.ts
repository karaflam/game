export function pickRandomItem<T>(items: readonly T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length)];
}
