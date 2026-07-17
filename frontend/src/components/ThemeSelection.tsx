import type { UiTheme } from '../types/game';

type ThemeSelectionProps = {
  themes: UiTheme[];
  selectedTheme: UiTheme | null;
  onSelectTheme: (theme: UiTheme) => void;
};

export function ThemeSelection({ themes, selectedTheme, onSelectTheme }: ThemeSelectionProps) {
  return (
    <section className="mt-6 p-6 bg-white rounded-2xl shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">Étape 1</span>
          <h2 className="mt-3 text-2xl font-bold">Choisissez votre thème visuel</h2>
          <p className="mt-2 text-sm text-slate-500">Personnalisez l’ambiance de l’interface avant de lancer votre prochaine partie.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {themes.map(theme => (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelectTheme(theme)}
            className={`w-full p-4 rounded-xl border bg-white hover:shadow-md flex items-center gap-4 transition ${
              selectedTheme?.id === theme.id ? 'ring-2 ring-indigo-500' : 'border-gray-200'
            }`}
            aria-pressed={selectedTheme?.id === theme.id}
          >
            <div className="w-12 h-12 rounded-lg" style={{ background: theme.accent }} />
            <div className="text-left">
              <h3 className="text-lg font-semibold">{theme.title}</h3>
              <p className="text-sm text-slate-500">{theme.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
