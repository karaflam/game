export function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}

export function isCorrectGuess(guess: string, answer: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(answer);
}

export function getHintForAttempt(hints: readonly string[], attempt: number): string {
  return hints[attempt % hints.length];
}
