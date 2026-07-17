import { Link, NavLink } from 'react-router-dom';
import { Gamepad2, Sparkles, User } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { uiThemes } from '../../data/uiThemes';
import useTheme from '../../hooks/useTheme';

export function Header() {
  const { theme, setTheme } = useTheme();
  const activeTheme = uiThemes.find(item => item.id === theme);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold text-foreground">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <span>GameHub</span>
        </Link>

        <nav className="hidden items-center gap-4 sm:flex">
          <NavLink to="/" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            Accueil
          </NavLink>
          <NavLink to="/classement" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            Classement
          </NavLink>
          <NavLink to="/profil" className={({ isActive }) =>
            `rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:text-foreground'}`
          }>
            Profil
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle themes={uiThemes} selectedTheme={activeTheme ?? uiThemes[0]} onSelectTheme={theme => setTheme(theme.id)} />
        </div>
      </div>
    </header>
  );
}
