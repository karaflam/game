import { Link, NavLink } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';
import { uiThemes } from '../../data/uiThemes';
import useTheme from '../../hooks/useTheme';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const activeTheme = uiThemes.find(item => item.id === theme);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 font-display text-xl font-semibold tracking-tight text-foreground">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <span>GameHub</span>
        </Link>

        <nav className="hidden items-center gap-4 sm:flex">
          <NavLink to="/" className={({ isActive }) =>
            `font-mono-label rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.home')}
          </NavLink>
          <NavLink to="/classement" className={({ isActive }) =>
            `font-mono-label rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.leaderboard')}
          </NavLink>
          <NavLink to="/profil" className={({ isActive }) =>
            `font-mono-label rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            {t('header.profile')}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle themes={uiThemes} selectedTheme={activeTheme ?? uiThemes[0]} onSelectTheme={theme => setTheme(theme.id)} />
        </div>
      </div>
    </header>
  );
}
