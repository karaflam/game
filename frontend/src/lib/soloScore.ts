export type ScoreState = { player: number; machine: number };
export type RoundOutcome = 'player' | 'machine' | 'draw';
export type Winner = 'player' | 'machine' | 'draw' | null;

export function createInitialScore(): ScoreState {
  return { player: 0, machine: 0 };
}

export function applyRoundOutcome(state: ScoreState, outcome: RoundOutcome): ScoreState {
  if (outcome === 'draw') {
    return state;
  }

  if (outcome === 'player') {
    return { ...state, player: state.player + 1 };
  }

  return { ...state, machine: state.machine + 1 };
}

export function getWinner(state: ScoreState, targetScore: number): Winner {
  if (state.player >= targetScore) {
    return 'player';
  }

  if (state.machine >= targetScore) {
    return 'machine';
  }

  return null;
}
