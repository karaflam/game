# Animations de manche et refonte visuelle du mode solo — Design

Date: 2026-07-17

## Contexte

Le mode solo (implémenté dans une session précédente, voir [2026-07-17-solo-mode-vs-ia-design.md](./2026-07-17-solo-mode-vs-ia-design.md)) fonctionne mais les manches se jouent sans mise en scène : le résultat s'affiche comme une simple phrase qui change, sans animation sur l'espace de jeu. L'utilisateur veut des parties nettement plus animées et vivantes.

## Objectif

Pour les 6 jeux solo :
1. Une **animation de révélation de manche qui occupe tout l'espace de jeu** (pas une phrase qui change) entre le moment où le joueur agit et le moment où le résultat est acquis.
2. Des contrôles de jeu repensés visuellement pour certains jeux (Pierre-Feuille-Ciseau, Pair ou Impair, Action ou Vérité).
3. Un badge de score repensé pour les 4 jeux compétitifs.

Choix visuels validés avec l'utilisateur via maquettes (compagnon visuel de brainstorming) :

| Élément | Choix retenu |
|---|---|
| Boutons Pierre-Feuille-Ciseau | Emojis géants (✊✋✌️) sur cartes |
| Roue "qui joue" (Action ou Vérité) | Carrousel d'avatars qui défile puis se fixe |
| Cartes de chiffres (Pair ou Impair) | Jetons ronds façon pièce de monnaie (1 à 9) |
| Badge de score | Barres de progression "course" vers le score cible |
| Révélation RPS | "Duel convergent" (les choix glissent des bords et se percutent au centre) |
| Révélation Pair ou Impair | "Cartes retournées" (flip) |
| Révélation Action ou Vérité | "Carte retournée" (flip, une seule carte pour le défi) |
| Révélation 20 Questions / Tu Préfères / 2 Vérités 1 Mensonge | "Décompte + explosion de particules" |

## Architecture

Tout reste 100% client (aucun changement à la logique pure déjà testée dans `frontend/src/lib/*`). On ajoute une couche de présentation :

### Composants de révélation partagés (`frontend/src/components/solo/reveals/`)

Chaque composant de jeu compétitif adopte un petit état de phase local :

```ts
type RoundPhase = 'choosing' | 'revealing';
```

Quand le joueur agit, le composant calcule immédiatement le coup de l'IA et l'issue (logique pure existante, synchrone), passe en phase `'revealing'`, et affiche le composant de révélation **à la place des contrôles de jeu**, sur toute la largeur/hauteur de la zone de jeu. Le composant de révélation gère sa propre temporisation interne (`useEffect` + `setTimeout`, nettoyé au démontage) et appelle `onComplete` à la fin de sa séquence (~2 à 2.2s). `onComplete` déclenche `recordRound(outcome)` (score), remet la phase à `'choosing'`, et met à jour le texte de statut. Si `isMatchOver` devient vrai, `MatchEndOverlay` (inchangé) prend le relais comme aujourd'hui.

**1. `DuelReveal`** — RPS uniquement.
```ts
type DuelRevealProps = {
  playerEmoji: string;
  playerLabel: string;
  machineEmoji: string;
  machineLabel: string;
  outcome: 'player' | 'machine' | 'draw';
  onComplete: () => void;
};
```
Les deux emojis glissent depuis les bords opposés vers le centre, un éclair "VS" apparaît brièvement à l'impact, puis une bannière de résultat (texte + icône) s'affiche. Durée totale ~2.2s.

**2. `FlipReveal`** — Pair ou Impair (2 cartes) et Action ou Vérité (1 carte).
```ts
type FlipCard = { id: string; content: ReactNode; highlight?: boolean };
type FlipRevealProps = {
  cards: FlipCard[];
  outcomeLabel?: string;
  onComplete: () => void;
};
```
Chaque carte démarre face cachée (dos coloré primary), effectue un flip 3D (`rotateY`) pour révéler son contenu. Une carte peut être mise en avant (`highlight`, halo). `outcomeLabel` s'affiche sous les cartes après le flip. Durée ~2s.

**3. `BurstReveal`** — 20 Questions, Tu Préfères ?, 2 Vérités 1 Mensonge.
```ts
type BurstRevealProps = {
  icon: 'success' | 'fail' | 'neutral';
  headline: string;
  detail?: string;
  onComplete: () => void;
};
```
Petites particules qui explosent radialement, le texte principal apparaît avec un effet ressort (spring scale-in), le détail s'affiche ensuite. Durée ~1.8s.

### Composants de contrôle repensés

**4. `RpsMoveCard`** (dans `RpsSolo.tsx`) — remplace les `Button` texte par des cartes cliquables avec un emoji 40px et un libellé, style cohérent avec les cartes jeu existantes (`rounded-2xl`, ombre au survol).

**5. `NumberTokenPicker`** (`frontend/src/components/solo/NumberTokenPicker.tsx`) — grille de 9 jetons ronds (1 à 9) remplaçant le `<input type="number">` de Pair ou Impair. Le jeton sélectionné grossit légèrement et prend la couleur primary.
```ts
type NumberTokenPickerProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};
```

**6. `PlayerWheel`** (`frontend/src/components/solo/PlayerWheel.tsx`) — carrousel d'avatars pour Action ou Vérité. Prend la liste des participants (en solo, un seul : "Vous"), anime un défilement horizontal rapide qui ralentit et se fixe sur le joueur désigné.
```ts
type PlayerWheelProps = {
  players: string[];
  spinning: boolean;
  landedOn: string | null;
  onSpinComplete: () => void;
};
```
Le flux Action ou Vérité change : bouton "Tourner la roue" → animation du carrousel (~1.5s) → le joueur désigné est affiché → boutons Action/Vérité apparaissent → sélection → `FlipReveal` (1 carte) révèle le texte du défi.

**7. `ScoreRaceBar`** — remplace le contenu interne de `frontend/src/components/solo/ScorePill.tsx` (même nom de fichier et même signature de props, donc aucun site d'appel à modifier). Deux barres de progression horizontales (Vous / IA) qui se remplissent vers `targetScore`, avec transition animée à chaque changement de score. Le bouton "Réinitialiser" reste dans le coin comme aujourd'hui.

## Intégration par jeu

- **RpsSolo** : boutons → `RpsMoveCard`. Au clic, calcule le coup IA + issue, passe en `'revealing'`, affiche `DuelReveal` à la place de la grille de boutons.
- **OddOrEvenSolo** : `<input>` → `NumberTokenPicker`. Le bouton "Jouer la manche" déclenche `'revealing'` avec `FlipReveal` (carte joueur + carte IA, texte de résultat en dessous).
- **TruthOrDareSolo** : ajoute `PlayerWheel` avant le choix Action/Vérité ; la révélation du texte utilise `FlipReveal` à une seule carte. Toujours sans score (inchangé).
- **TwentyQuestionsSolo** : sur bonne réponse ou essais épuisés, `BurstReveal` (icône succès/échec) remplace la zone indice + input, puis le bouton "Manche suivante" apparaît comme aujourd'hui.
- **WouldYouRatherSolo** : après le choix du joueur, `BurstReveal` (icône neutre) remplace les deux boutons d'options le temps de la révélation, avant d'afficher "Prochain dilemme". Toujours sans score.
- **TwoTruthsOneLieSolo** : après la sélection d'une affirmation, `BurstReveal` remplace la grille de 3 boutons, révèle laquelle était le mensonge, puis "Série suivante" apparaît.
- **RpsSolo, OddOrEvenSolo, TwentyQuestionsSolo, TwoTruthsOneLieSolo** : `ScorePill` (déjà branché) affiche désormais les barres de progression via la refonte interne du composant.

## MatchEndOverlay — refonte de l'icône

`frontend/src/components/solo/MatchEndOverlay.tsx` (fin de partie complète, pas de manche) est mis à jour : l'icône `lucide-react` actuelle (`PartyPopper`/`Frown`, petite, dans un cercle) est remplacée par un **emoji géant animé** :
- Victoire (`winner === 'player'`) : emoji 🎉 ou 😄 en très grand (~80-96px), animation de rebond/agrandissement ressort à l'apparition, puis léger balancement continu (repris du rebond vertical déjà présent).
- Défaite (`winner === 'machine'`) : emoji 😢 ou 😞 en grand, animation plus sobre (fade + léger tremblement/affaissement), pas de rebond joyeux.

Le reste de l'overlay (titre, texte, bouton "Nouvelle partie") ne change pas.

## Hors scope

- Pas de sons/audio.
- Pas de personnalisation de la durée des animations par l'utilisateur.
- Le carrousel `PlayerWheel` ne gère qu'un seul participant pour l'instant (mode solo) ; sa prop `players` accepte une liste pour rester réutilisable plus tard en multijoueur, mais aucune intégration multijoueur n'est faite ici.
