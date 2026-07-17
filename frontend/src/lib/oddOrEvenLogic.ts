export type Parity = 'pair' | 'impair';

export function getParity(sum: number): Parity {
  return sum % 2 === 0 ? 'pair' : 'impair';
}

export function getOddOrEvenOutcome(
  playerNumber: number,
  prediction: Parity,
  machineNumber: number
): 'player' | 'machine' {
  const actual = getParity(playerNumber + machineNumber);
  return prediction === actual ? 'player' : 'machine';
}

export function pickRandomNumber(random: () => number = Math.random): number {
  return Math.floor(random() * 9) + 1;
}
