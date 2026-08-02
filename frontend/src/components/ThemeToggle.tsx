import { Heart, Moon, Sparkles, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UiTheme } from '../types/game';

type Props = {
  themes: UiTheme[];
  selectedTheme: UiTheme | null;
  onSelectTheme: (theme: UiTheme) => void;
};

const themeIcon = {
  clair: Sun,
  sombre: Moon,
  luxueux: Sparkles,
  romantique: Heart
};

export default function ThemeToggle({ themes, selectedTheme, onSelectTheme }: Props) {
  const { t } = useTranslation();
  const activeId = selectedTheme?.id ?? themes[0]?.id;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary p-1">
      {themes.map(theme => {
        const ThemeIcon = themeIcon[theme.id];
        const isActive = theme.id === activeId;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelectTheme(theme)}
            aria-label={t(`themes.${theme.id}.title`)}
            aria-pressed={isActive}
            title={t(`themes.${theme.id}.title`)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-secondary-foreground/60 hover:text-secondary-foreground'
            }`}
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
