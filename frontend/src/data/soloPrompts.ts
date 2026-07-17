import type { Triplet } from '../lib/twoTruthsLogic';

export type TruthOrDarePrompt = { truth: string; dare: string };
export type WouldYouRatherPrompt = { left: string; right: string };
export type WordPrompt = { answer: string; hints: string[] };
export type LieTriplet = Triplet;

export const soloTruthOrDarePrompts: TruthOrDarePrompt[] = [
  { truth: 'Quelle est ta plus grande peur ?', dare: 'Chante le refrain de ta chanson préférée.' },
  { truth: 'Quel est ton plus grand secret ?', dare: 'Fais 10 sauts en étoile.' },
  { truth: 'Quel est ton rêve le plus étrange ?', dare: 'Imite un animal pendant 15 secondes.' },
  { truth: 'Quelle est la chose la plus embarrassante que tu aies faite ?', dare: 'Parle avec un accent au choix pendant 1 minute.' },
  { truth: 'Quel est ton plus grand regret ?', dare: 'Fais une danse improvisée pendant 20 secondes.' },
  { truth: 'As-tu déjà menti à un proche pour éviter un conflit ?', dare: 'Raconte une blague, même mauvaise.' },
  { truth: 'Quelle est la chose la plus folle que tu aimerais essayer un jour ?', dare: 'Fais 15 pompes, ou l’équivalent avec les genoux au sol.' },
  { truth: 'Quel est ton talent caché ?', dare: 'Imite la voix d’un personnage célèbre.' }
];

export const soloWouldYouRatherPrompts: WouldYouRatherPrompt[] = [
  { left: 'Vivre sans musique', right: 'Vivre sans films' },
  { left: 'Pouvoir voler', right: 'Être invisible' },
  { left: 'Avoir un jet privé', right: 'Avoir une île privée' },
  { left: 'Lire dans les pensées', right: 'Voir le futur' },
  { left: 'Ne plus jamais manger de sucré', right: 'Ne plus jamais manger de salé' },
  { left: 'Vivre à la montagne', right: 'Vivre à la mer' },
  { left: 'Avoir plus de temps libre', right: 'Avoir plus d’argent' },
  { left: 'Parler toutes les langues du monde', right: 'Jouer de tous les instruments de musique' }
];

export const soloTwentyQuestionsWords: WordPrompt[] = [
  { answer: 'chat', hints: ['Je suis un animal', 'Je ronronne', 'Je chasse les souris', 'On me trouve souvent chez les gens'] },
  { answer: 'vélo', hints: ['Je roule', 'J’ai deux roues', 'On me pousse avec les pieds', 'On peut me garer devant chez soi'] },
  { answer: 'ordinateur', hints: ['Je fais des calculs', 'Je suis électronique', 'On m’utilise pour travailler', 'J’ai souvent un clavier'] },
  { answer: 'guitare', hints: ['Je suis un instrument', 'J’ai des cordes', 'On me joue avec les doigts ou un médiator', 'Je peux être électrique ou acoustique'] },
  { answer: 'parapluie', hints: ['Je te protège', 'Je m’ouvre', 'On m’utilise quand il pleut', 'Je peux me retourner avec le vent'] },
  { answer: 'téléphone', hints: ['Je sers à communiquer', 'Je tiens dans la main', 'J’ai un écran', 'On m’utilise pour appeler ou envoyer des messages'] },
  { answer: 'montagne', hints: ['Je suis haute', 'On peut me gravir', 'J’ai parfois de la neige au sommet', 'Je fais partie du paysage'] },
  { answer: 'livre', hints: ['J’ai des pages', 'On me lit', 'Je raconte parfois une histoire', 'On me trouve dans une bibliothèque'] }
];

export const soloTwoTruthsOneLieTriplets: LieTriplet[] = [
  { statements: ['J’ai déjà mangé des insectes.', 'Je suis déjà monté sur un chameau.', 'J’ai déjà nagé avec des requins sans cage.'], lieIndex: 2 },
  { statements: ['Je parle trois langues.', 'J’ai déjà gagné un concours de talent.', 'J’ai un frère jumeau.'], lieIndex: 1 },
  { statements: ['J’ai peur des araignées.', 'J’ai déjà sauté en parachute.', 'Je n’ai jamais cassé un os.'], lieIndex: 1 },
  { statements: ['J’ai déjà rencontré un chanteur célèbre.', 'Je sais faire une roue (gymnastique).', 'J’ai déjà dormi dans un avion pendant 12 heures.'], lieIndex: 0 },
  { statements: ['Je suis allergique aux fraises.', 'J’ai déjà couru un marathon.', 'J’ai déjà perdu un pari stupide.'], lieIndex: 1 },
  { statements: ['J’ai déjà visité 4 continents.', 'Je sais faire du unicycle.', 'J’ai déjà chanté sur scène devant 100 personnes.'], lieIndex: 1 },
  { statements: ['J’ai un animal de compagnie exotique.', 'Je n’ai jamais pris l’avion.', 'J’ai déjà gagné à la loterie (un petit lot).'], lieIndex: 0 },
  { statements: ['Je sais faire du surf.', 'J’ai déjà rencontré un président.', 'J’ai déjà campé sous les étoiles sans tente.'], lieIndex: 1 }
];
