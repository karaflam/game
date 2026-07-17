import type { GameMode, GameTheme, ScoreState } from '../types/game';

type ControlPanelProps = {
  selectedGame: GameTheme | null;
  mode: GameMode;
  connected: boolean;
  score: ScoreState;
  playerLabels: [string, string];
  gameEnded: boolean;
  onModeChange: (mode: GameMode) => void;
  onEndGame: () => void;
  onReset: () => void;
  onAddPoint: (player: keyof ScoreState) => void;
};

export function ControlPanel({
  selectedGame,
  mode,
  connected,
  score,
  playerLabels,
  gameEnded,
  onModeChange,
  onEndGame,
  onReset,
  onAddPoint
}: ControlPanelProps) {
  return (
    <aside className="p-4 rounded-xl bg-white border shadow-sm">
      <h2 className="text-lg font-semibold">Détails du jeu</h2>
      <p className="text-sm text-slate-500">{selectedGame ? selectedGame.description : 'Choisissez un jeu pour afficher les détails et démarrer la partie.'}</p>
      <div className="mt-4">
        <strong>Statut :</strong>{' '}
        <span className="text-sm text-slate-600">{selectedGame ? (gameEnded ? 'Partie terminée' : 'Prête à démarrer') : 'Aucun jeu sélectionné'}</span>
      </div>
      <div className="mt-4 grid gap-3">
        <button
          type="button"
          onClick={onEndGame}
          disabled={!selectedGame || gameEnded}
          className={`px-4 py-2 rounded-lg text-white ${!selectedGame || gameEnded ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          Terminer la partie
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 rounded-lg border bg-white text-slate-700 hover:shadow-sm"
        >
          Réinitialiser la sélection
        </button>
      </div>
    </aside>
  );
}
