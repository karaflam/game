export type Triplet = { statements: [string, string, string]; lieIndex: 0 | 1 | 2 };

export function shuffleTriplet(triplet: Triplet, random: () => number = Math.random): Triplet {
  const order = [0, 1, 2];

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const statements = order.map(index => triplet.statements[index]) as [string, string, string];
  const lieIndex = order.indexOf(triplet.lieIndex) as 0 | 1 | 2;

  return { statements, lieIndex };
}
