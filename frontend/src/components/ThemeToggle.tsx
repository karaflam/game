import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Gamepad2, Heart, Moon, Sparkles, Sun } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const activeTheme = selectedTheme ?? themes[0];
  const Icon = useMemo(() => themeIcon[activeTheme.id], [activeTheme]);

  return (
    <div className="relative inline-flex text-left">
      <Button
        variant="secondary"
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{activeTheme.title}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="absolute right-0 left-auto z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="p-2">
            {themes.map(theme => {
              const ThemeIcon = themeIcon[theme.id];
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(theme);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted ${
                    selectedTheme?.id === theme.id ? 'bg-muted' : ''
                  }`}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                    <ThemeIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{theme.title}</div>
                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
