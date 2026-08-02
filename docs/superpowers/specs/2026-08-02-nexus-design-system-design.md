# Nexus-style design system — Design

## Contexte

Le client fournit un prototype Figma ("NexusHub") comme référence visuelle et demande de reproduire sa typographie et la forme de ses boutons sur l'ensemble du site. L'app actuelle (React + Tailwind v4, variables CSS par thème dans `frontend/src/index.css`, `frontend/tailwind.config.js`) a 4 thèmes de couleur (`clair`, `sombre`, `luxueux`, `romantique`), la police Geist Variable partout, et des boutons à coin arrondi classique (`rounded-lg`, radius ~10px).

**Décision de périmètre** (confirmée avec l'utilisateur) : le nouveau système de forme + typographie s'applique **par-dessus** les 4 thèmes de couleur existants, qui gardent leurs couleurs. Seules la police, la forme des boutons/badges/cartes et les proportions changent — pas la palette.

## Ce qu'on reproduit du prototype

- **Deux familles de police** : une display bold pour titres/chiffres, une monospace en petites majuscules espacées pour labels/badges/métadonnées.
- **Boutons et badges en pilule** (`rounded-full`) au lieu de coins arrondis classiques : CTA plein (couleur `primary`), CTA outline/secondaire, boutons icône circulaires.
- **Cartes** avec coins plus arrondis (`rounded-2xl`/`rounded-3xl`), fond `card`, ombre douce — déjà proche de l'existant, ajustement de radius uniquement.
- **Nav active en pilule pleine** (déjà le cas dans `Header.tsx` via `bg-primary` sur le lien actif — juste le radius à ajuster).

## Architecture

### Polices

Ajout de deux polices via Fontsource (même mécanisme que Geist actuel) :
- `@fontsource-variable/space-grotesk` → titres, chiffres, headings (`h1`-`h3`, stat numbers)
- `@fontsource/jetbrains-mono` (poids 600/700) → labels uppercase, badges, eyebrows, boutons

Nouveaux tokens dans `@theme inline` (frontend/src/index.css) :
```css
--font-display: 'Space Grotesk Variable', var(--font-sans);
--font-mono-label: 'JetBrains Mono', ui-monospace, monospace;
```
Classes utilitaires Tailwind générées automatiquement : `font-display`, `font-mono-label`.

Application :
- `h1, h2, h3` et les gros chiffres de stats → `font-display font-bold tracking-tight`
- Eyebrows (`.eyebrow`), badges, labels de section ("Étape 1", "NIVEAU"-style), boutons → `font-mono-label uppercase tracking-wide text-xs font-semibold`

### Boutons (`frontend/src/components/ui/button.tsx`)

Le composant `Button` (cva) passe de `rounded-lg` à `rounded-full` dans la classe de base. Tailles `icon`/`icon-sm`/`icon-lg` restent circulaires (déjà `size-*` carré + le nouveau `rounded-full` suffit). Le label des boutons passe en `font-mono-label uppercase tracking-wide text-xs font-semibold` (ajout dans `buttonVariants` de base).

Les boutons custom hors du composant partagé (`button.primary`/`button.secondary` en CSS brut dans `index.css`, utilisés par d'anciens écrans) sont alignés sur le même radius (`border-radius: 999px`).

### Cartes et badges

Dans `index.css`, les classes `.game-card`, `.selection-card`, `.panel-card`, `.status-card`, `.info-panel`, `.empty-state`, `.game-panel`, `.panel-summary` passent de `border-radius: 20px/24px` à `border-radius: 24px` uniformisé (déjà proche — petit ajustement de cohérence, pas une refonte). `.badge`, `.mode-pill` restent `border-radius: 999px` (déjà pilule) mais passent en `font-mono-label uppercase`.

Le composant `GameCard.tsx` (badge "2 joueurs") et tout badge similaire (`ThemeToggle`, `LanguageToggle` labels de bouton) suivent la même règle typographique.

### Portée des fichiers touchés

- `frontend/src/index.css` — nouveaux tokens de police, ajustement des radius de cartes/badges
- `frontend/tailwind.config.js` — pas de changement structurel (les couleurs restent pilotées par variables CSS existantes) ; ajout éventuel d'un alias `font-display`/`font-mono-label` si Tailwind v4 ne les expose pas déjà via `@theme inline`
- `frontend/src/components/ui/button.tsx` — radius + typographie de label
- `frontend/package.json` — deux nouvelles dépendances Fontsource
- Composants qui utilisent des classes de titre/heading en dur (h1/h2/h3 via Tailwind `text-4xl font-bold` etc. dans les pages) — passage à `font-display` en plus des classes existantes, sans changer la taille/le layout
- Pas de changement de contenu, de logique, de routes, ni de palette de couleur

## Tests / vérification

Pas de tests automatisés pertinents (changement purement visuel). Vérification : `npm run build` doit passer, `npx tsc --noEmit` propre, puis vérification visuelle via `npm run dev` sur les pages principales (accueil, sélection de jeu, salon, partie, résultats) dans au moins 2 des 4 thèmes de couleur pour confirmer que la forme/typo est cohérente indépendamment de la couleur.
