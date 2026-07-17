export function getRandomElement<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function isEven(value: number) {
  return value % 2 === 0;
}
