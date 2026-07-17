import type { GameTheme } from '../types/game';

export const gameThemes: GameTheme[] = [
  {
    id: 'rps',
    title: 'Pierre, Feuille, Ciseau',
    description: 'Affrontez un adversaire en devinant la main gagnante.'
  },
  {
    id: 'truth-or-dare',
    title: 'Action ou Vérité',
    description: 'Une roue choisit un joueur. L’autre valide l’action ou la vérité.'
  },
  {
    id: 'odd-or-even',
    title: 'Pair ou Impair',
    description: 'Chacun choisit un chiffre et prédit si la somme sera paire ou impaire.'
  },
  {
    id: 'would-you-rather',
    title: 'Tu Préfères ?',
    description: 'Choisissez entre deux dilemmes amusants ou surprenants.'
  },
  {
    id: '20-questions',
    title: '20 Questions',
    description: 'Un joueur pense à quelque chose, l’autre a 20 essais pour deviner.'
  },
  {
    id: 'two-truths-one-lie',
    title: '2 Vérités, 1 Mensonge',
    description: 'Un joueur propose 3 faits, les autres votent pour le mensonge.'
  }
];
