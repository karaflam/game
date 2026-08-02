import { Heart, HelpCircle, Scissors, Shuffle, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameTheme } from '../types/game';
import { getGameImageUrl } from '../data/gameImages';

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
  const { t } = useTranslation();
  const Icon = icons[game.id] ?? Sparkles;

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      className={`group w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        selected ? 'ring-2 ring-offset-2 ring-primary' : ''
      }`}
    >
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={getGameImageUrl(game.id)}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 text-white backdrop-blur-sm">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-mono-label rounded-full bg-black/40 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-sm">
            {t('gameCard.playerCount')}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-6">
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{t(`games.${game.id}.title`)}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{t(`games.${game.id}.description`)}</p>
      </div>
    </button>
  );
}
