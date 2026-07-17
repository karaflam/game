export type GameMode = 'solo' | 'multi';

export type GameTheme = {
  id: GameId;
  title: string;
  description: string;
};

export type UiTheme = {
  id: 'clair' | 'sombre' | 'luxueux' | 'romantique';
  title: string;
  description: string;
  accent: string;
};

export type GameId =
  | 'rps'
  | 'truth-or-dare'
  | 'odd-or-even'
  | 'would-you-rather'
  | '20-questions'
  | 'two-truths-one-lie';

export type ScoreState = {
  player1: number;
  player2: number;
};

export type AppState = {
  selectedGame: GameTheme | null;
  mode: GameMode;
  score: ScoreState;
  gameEnded: boolean;
};
