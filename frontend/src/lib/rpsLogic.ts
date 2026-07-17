export const RPS_MOVES = ['pierre', 'feuille', 'ciseau'] as const;
export type RpsMove = (typeof RPS_MOVES)[number];

const beats: Record<RpsMove, RpsMove> = {
  pierre: 'ciseau',
  feuille: 'pierre',
  ciseau: 'feuille'
};

export function getRpsOutcome(player: RpsMove, machine: RpsMove): 'player' | 'machine' | 'draw' {
  if (player === machine) {
    return 'draw';
  }
  return beats[player] === machine ? 'player' : 'machine';
}

export function pickRandomRpsMove(random: () => number = Math.random): RpsMove {
  return RPS_MOVES[Math.floor(random() * RPS_MOVES.length)];
}
