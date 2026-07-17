import type { GameTheme } from '../types/game';
import { GameCard } from './GameCard';

type GameSelectionProps = {
  selectedGame: GameTheme | null;
  games: GameTheme[];
  onSelectGame: (game: GameTheme) => void;
  onBack: () => void;
};

export function GameSelection({ selectedGame, games, onSelectGame, onBack }: GameSelectionProps) {
  return (
    <section className="mt-6 p-6 bg-white rounded-2xl shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">Étape 2</span>
          <h2 className="mt-3 text-2xl font-bold">Choisissez un jeu</h2>
          <p className="mt-2 text-sm text-slate-500">Parcourez les jeux disponibles et sélectionnez celui que vous voulez lancer.</p>
        </div>
        <button type="button" className="text-indigo-600 font-bold" onClick={onBack}>
          Changer de thème
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {games.map(game => (
          <GameCard key={game.id} game={game} selected={selectedGame?.id === game.id} onSelect={onSelectGame} />
        ))}
      </div>
    </section>
  );
}
