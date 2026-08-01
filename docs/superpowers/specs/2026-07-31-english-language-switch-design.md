# Changement de langue vers l'anglais — Design

## Contexte

L'application (frontend React + backend Node) est entièrement en français, texte en dur dans les composants. L'objectif est de permettre à l'utilisateur de basculer l'interface en anglais.

**Périmètre de cette phase** : l'UI uniquement (navigation, pages, composants de jeu solo/multijoueur, noms/descriptions de thèmes et de jeux, catégories Action ou Vérité).

**Hors périmètre** (phase séparée à venir) : le contenu ludique — les questions/gages/dilemmes dans `frontend/src/data/soloPrompts.ts` (389 lignes) et sa copie côté serveur `backend/src/gamePrompts.ts` (365 lignes). Ce contenu reste en français pour l'instant ; sa traduction est un travail de rédaction de contenu à part entière (des centaines d'entrées), traité ultérieurement.

Le backend ne renvoie aucun texte français destiné à l'affichage direct (`roomManager.ts`, `events.ts` ne contiennent que des identifiants/événements) — aucune localisation serveur n'est nécessaire pour cette phase.

## Architecture

- **Librairie** : `react-i18next` + `i18next` + `i18next-browser-languagedetector` (nouvelles dépendances frontend).
- **Initialisation** : `frontend/src/lib/i18n.ts`, importé une fois au tout début de `frontend/src/main.tsx`.
- **Ressources de traduction** : deux fichiers JSON, `frontend/src/locales/fr/translation.json` et `frontend/src/locales/en/translation.json`.
- **Détection/persistance de la langue** : ordre de détection `localStorage` (clé `game:language`) → langue du navigateur → repli sur `fr`. Suit le même pattern que `useTheme.ts` (clé `game:theme`).
- **Consommation dans les composants** : chaque composant affichant du texte utilise le hook `useTranslation()` d'i18next et remplace ses chaînes en dur par `t('clé')`.

## Structure des clés de traduction

Organisation par domaine fonctionnel (pas par nom de fichier composant, pour rester stable si des fichiers sont renommés) :

```json
{
  "common": { "back": "...", "cancel": "...", "confirm": "...", ... },
  "header": { "home": "...", "leaderboard": "...", "profile": "..." },
  "footer": { ... },
  "home": { ... },
  "games": {
    "rps": { "title": "...", "description": "..." },
    "truthOrDare": { "title": "...", "description": "..." },
    "oddOrEven": { "title": "...", "description": "..." },
    "wouldYouRather": { "title": "...", "description": "..." },
    "twentyQuestions": { "title": "...", "description": "..." },
    "twoTruthsOneLie": { "title": "...", "description": "..." }
  },
  "themes": {
    "clair": { "title": "...", "description": "..." },
    "sombre": { "title": "...", "description": "..." },
    "luxueux": { "title": "...", "description": "..." },
    "romantique": { "title": "...", "description": "..." }
  },
  "truthOrDareCategories": {
    "general": { "label": "...", "description": "..." },
    "amis": { ... }, "couple": { ... }, "famille": { ... },
    "audacieux": { ... }, "nostalgie": { ... }, "vie": { ... },
    "desir": { ... }, "intimite": { ... }
  },
  "modeSelection": { ... },
  "lobby": { ... },
  "scoreBoard": { ... },
  "controlPanel": { ... },
  "gamePlay": { ... },
  "results": { ... },
  "profile": { ... },
  "leaderboard": { ... },
  "reconnecting": { ... }
}
```

Les clés exactes sous chaque domaine sont extraites lors de l'implémentation, en passant en revue chacun des ~42 fichiers `.tsx` contenant du texte français.

## Fichiers de données (`gameThemes.ts`, `uiThemes.ts`, catégories Action/Vérité)

Ces tableaux sont consommés par plusieurs composants (`GameCard`, `ThemeToggle`, `ThemeSelection`, `GameSelection`...). Pour éviter de dupliquer titre/description à la fois dans le JSON de traduction et dans le fichier data :

- Les fichiers data ne conservent que l'`id` et les métadonnées non textuelles (icône, couleur d'accent).
- Les composants qui affichaient `theme.title` / `theme.description` appellent désormais `t(\`games.${theme.id}.title\`)` / `t(\`themes.${theme.id}.description\`)`, etc.
- Le commentaire `// Kept in sync with backend/src/gamePrompts.ts` sur `TRUTH_OR_DARE_CATEGORIES` (frontend/src/data/gameThemes.ts:16) ne concerne que les catégories, qui font partie du périmètre UI — leurs libellés migrent aussi vers `truthOrDareCategories.*`.

## Sélecteur de langue

- Nouveau composant `frontend/src/components/LanguageToggle.tsx`, calqué sur `ThemeToggle.tsx` (bouton + dropdown, même style visuel).
- Nouveau hook `frontend/src/hooks/useLanguage.ts`, calqué sur `useTheme.ts` : expose `{ language, setLanguage }`, synchronisé avec `i18next.changeLanguage()` et persisté dans `localStorage` sous `game:language`.
- Placement : dans `Header.tsx`, juste à côté du `ThemeToggle` existant.
- Deux langues : `fr` (drapeau/libellé "Français") et `en` ("English").

## Gestion des erreurs

- Si `localStorage` est indisponible (mode privé strict), le hook suit le même pattern défensif que `useTheme.ts` (try/catch, repli sur la détection navigateur puis `fr`).
- Si une clé de traduction est manquante dans une langue, i18next affiche la clé brute en dev (comportement par défaut) — acceptable pour cette phase, pas de fallback custom nécessaire vu que les deux fichiers JSON sont écrits en parallèle.

## Tests

- Pas de nouveaux tests unitaires dédiés à la traduction (le contenu textuel n'est pas testé actuellement dans les tests existants — `*.test.ts` couvrent la logique de jeu, pas le rendu de texte).
- Vérification manuelle : lancer l'app, basculer FR/EN via le sélecteur, parcourir les pages principales (accueil, sélection de jeu, mode, lobby, partie solo et multijoueur, résultats, classement, profil) pour confirmer qu'aucun texte ne reste codé en dur et que la mise en page ne casse pas avec des libellés anglais plus longs/courts.
- Vérifier que le choix de langue persiste après rechargement de la page.
