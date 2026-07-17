import type { GameMode, GameTheme } from '../types/game';

type ModeSelectionProps = {
  selectedGame: GameTheme;
  currentMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
};

const modeDetails: Record<GameMode, { title: string; subtitle: string }> = {
  solo: {
    title: 'Solo',
    subtitle: 'Jouez immédiatement seul et affinez votre stratégie.'
  },
  multi: {
    title: 'Multijoueur',
    subtitle: 'Créez ou rejoignez une salle pour défier un ami en temps réel.'
  }
};

export function ModeSelection({ selectedGame, currentMode, onSelectMode, onBack }: ModeSelectionProps) {
  return (
    <section className="mt-6 p-6 bg-white rounded-2xl shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">Étape 3</span>
          <h2 className="mt-3 text-2xl font-bold">Choisissez votre mode</h2>
          <p className="mt-2 text-sm text-slate-500">Le mode solo vient après la sélection du jeu pour un parcours plus clair.</p>
        </div>
        <button type="button" className="text-indigo-600 font-bold" onClick={onBack}>
          Retour à la sélection de jeu
        </button>
      </div>

      <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-dashed">
        <strong>Jeu choisi :</strong> {selectedGame.title}
        <p className="text-sm text-slate-500">{selectedGame.description}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['solo', 'multi'] as GameMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            className={`w-full p-4 rounded-xl border bg-white hover:shadow-md flex items-center gap-4 transition ${
              currentMode === mode ? 'ring-2 ring-indigo-500' : 'border-gray-200'
            }`}
            onClick={() => onSelectMode(mode)}
          >
            <div className="px-3 py-2 rounded-full bg-indigo-50 text-indigo-600 font-bold">{modeDetails[mode].title}</div>
            <div>
              <h3 className="text-sm font-semibold">{modeDetails[mode].subtitle}</h3>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
