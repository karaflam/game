import { Heart, HelpCircle, Scissors, Shuffle, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameTheme } from '../types/game';
import { getGameImageUrl } from '../data/gameImages';
import { useImageAvailable } from '../hooks/useImageAvailable';

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
  const imageUrl = getGameImageUrl(game.id);
  const hasImage = useImageAvailable(imageUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect(game)}
      style={hasImage ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      className={`group relative flex h-56 w-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        selected ? 'ring-2 ring-offset-2 ring-primary' : ''
      }`}
    >
      {/* While the image hasn't loaded (or fails to), nothing below renders — the button stays
          exactly the plain themed card (bg-card, border-border) it was before images existed. */}
      {hasImage ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 transition-opacity duration-300 group-hover:from-black/90" />
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur-sm ${
            hasImage ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={`font-mono-label rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] backdrop-blur-sm ${
            hasImage ? 'bg-white/15 text-white' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          {t('gameCard.playerCount')}
        </span>
      </div>

      <div className="relative space-y-2">
        <h3 className={`font-display text-xl font-semibold tracking-tight ${hasImage ? 'text-white' : 'text-foreground'}`}>
          {t(`games.${game.id}.title`)}
        </h3>
        <p className={`text-sm leading-6 ${hasImage ? 'text-white/80' : 'text-muted-foreground'}`}>{t(`games.${game.id}.description`)}</p>
      </div>
    </button>
  );
}
