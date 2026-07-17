import type { ScoreState } from '../types/game';

type ScoreBoardProps = {
  mode: 'solo' | 'multi';
  connected: boolean;
  score: ScoreState;
  playerLabels: [string, string];
  disabled: boolean;
  onAddPoint: (player: keyof ScoreState) => void;
};

export function ScoreBoard({ mode, connected, score, playerLabels, disabled, onAddPoint }: ScoreBoardProps) {
  return (
    <section className="mt-6 p-4 bg-white rounded-xl border shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Score</h2>
        <span className={`${connected ? 'text-green-700' : 'text-red-600'} text-sm`}>{connected ? 'Serveur connecté' : 'Serveur déconnecté'}</span>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <strong>{playerLabels[0]}</strong>
          <span>{score.player1}</span>
          <button
            type="button"
            onClick={() => onAddPoint('player1')}
            disabled={disabled}
            className={`px-3 py-1 rounded-md border ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-slate-50'}`}
          >
            +1
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <strong>{playerLabels[1]}</strong>
          <span>{score.player2}</span>
          <button
            type="button"
            onClick={() => onAddPoint('player2')}
            disabled={disabled}
            className={`px-3 py-1 rounded-md border ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-slate-50'}`}
          >
            +1
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 border">
        <h3 className="m-0 mb-2 text-sm font-semibold">Instructions rapides</h3>
        <ul className="m-0 ml-5 text-sm text-slate-600">
          <li>Choisissez un jeu dans la liste.</li>
          <li>Sélectionnez solo ou multijoueur.</li>
          <li>Utilisez les boutons de score pour suivre la partie.</li>
          <li>Appuyez sur « Terminer la partie » pour clôturer.</li>
        </ul>
      </div>
    </section>
  );
}
