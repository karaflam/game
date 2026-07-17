import { Heart, HelpCircle, Scissors, Shuffle, Sparkles, Users } from 'lucide-react';
import type { GameTheme } from '../types/game';

type GameCardProps = {
  game: GameTheme;
  selected: boolean;
  onSelect: (game: GameTheme) => void;
};

const icons = {
  'rps': Scissors,
  'truth-or-dare': Sparkles,
  'odd-or-even': Shuffle,
  'would-you-rather': Heart,
  '20-questions': HelpCircle,
  'two-truths-one-lie': Users
};

export function GameCard({ game, selected, onSelect }: GameCardProps) {
  const Icon = icons[game.id] ?? Sparkles;

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      className={`group w-full rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        selected ? 'ring-2 ring-offset-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-foreground">
          2 joueurs
        </span>
      </div>
      <div className="mt-6 space-y-3 text-left">
        <h3 className="text-xl font-semibold text-foreground">{game.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{game.description}</p>
      </div>
    </button>
  );
}
