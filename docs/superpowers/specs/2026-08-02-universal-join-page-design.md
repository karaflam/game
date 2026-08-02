# Page de join universelle (sans sélection de jeu) — Design

## Contexte

Actuellement, rejoindre un salon exige de d'abord choisir un jeu (`HomePage` → `GameModePage` → `RoomLobbyPage`, route `/jeu/:gameId/salon/creer`), qui valide que le code de salon correspond bien à ce jeu. Cette feature ajoute un chemin alternatif : rejoindre un salon avec juste un code, sans savoir/choisir le jeu au préalable — le serveur détermine le jeu à partir du salon.

**Coexistence** : cette nouvelle page ne remplace pas le flux existant (`RoomLobbyPage` garde son comportement de create+join lié à un `gameId`). C'est un raccourci accessible depuis un bouton dans le hero de `HomePage`.

## Backend (`backend/src/roomManager.ts`, `backend/src/index.ts`)

- `roomManager.joinRoom(roomId, socketId, name, gameId, token)` : le paramètre `gameId` devient optionnel (`gameId?: string`). Si fourni, la validation existante (`room-game-mismatch` si ça ne correspond pas) reste inchangée. Si absent, on saute cette validation et on utilise directement `room.gameId`.
- Le retour de `joinRoom` inclut déjà (ou est complété pour inclure) `gameId: room.gameId`, pour que l'appelant connaisse le jeu réel sans l'avoir fourni.
- `index.ts` : le handler `ClientEvents.JoinRoom` accepte `gameId` optionnel dans le payload reçu. L'émission `ServerEvents.RoomUpdate` (celle vers le salon rejoint) ajoute un champ `gameId` (issu de `result.gameId`) — champ additif, ne casse aucun consommateur existant qui ignore les champs inconnus. Le check `if (gameId === 'truth-or-dare')` (pour renvoyer l'état des catégories) utilise désormais `result.gameId` plutôt que le `gameId` reçu du client, pour rester correct même quand il n'a pas été fourni.

## Frontend

### Nouvelle page `frontend/src/pages/JoinPage.tsx`

- Route `/rejoindre` (ajoutée dans `App.tsx`, pas de paramètre d'URL).
- Formulaire minimal : pseudo (réutilise `getStoredPseudo`/`setStoredPseudo` comme `RoomLobbyPage`) + code de salon.
- Au submit : `socket.emit(ClientEvents.JoinRoom, { roomId: code, name, token })` — **sans** `gameId`.
- Sur `ServerEvents.RoomUpdate` : lit `gameId` depuis la réponse, alimente le store (`setGameId`, `setRoomCode`, `setPlayers`, `setStatus`, `setScores` si présent), appelle `saveActiveRoom({ gameId, roomCode: code })`, puis navigue vers `/jeu/${gameId}/salon/${code}` (ou `.../partie` si `started`) — même logique que `RoomLobbyPage.handleJoinRoom`.
- Sur `ServerEvents.RoomError` : affiche l'erreur traduite via `translateRoomError` (réutilisé tel quel).
- Réutilise le composant `Button` et les mêmes classes de carte/formulaire que `RoomLobbyPage` pour rester visuellement cohérent avec le design system actuel.

### `HomePage.tsx`

Ajout d'un bouton secondaire dans la section hero (à côté de l'eyebrow "Bienvenue"/titre/sous-titre), qui navigue vers `/rejoindre`.

### Traductions

Nouvelles clés (fr + en, mêmes fichiers `frontend/src/locales/{fr,en}/translation.json`) :
- `joinPage.*` : titre, description, label pseudo, placeholder pseudo, label code, placeholder code, bouton, messages d'erreur (réutilise les clés `roomLobbyPage.errorPseudoRequired` / `errorRoomCodeRequired` / `errorNoServerConnection` existantes plutôt que de les dupliquer)
- `home.joinButton` : libellé du bouton hero (ex. "Rejoindre une partie" / "Join a game")

## Hors périmètre

- Pas de changement au flux `RoomLobbyPage` existant (create + join avec `gameId` connu).
- Pas de test automatisé dédié (le projet n'a pas de tests sur les flux socket/pages, cohérent avec l'existant).

## Vérification

`npx tsc --noEmit`, `npm test` (33/33 doivent rester verts), `npm run build`, puis vérification manuelle : rejoindre un salon existant via `/rejoindre` sans connaître son jeu et confirmer l'arrivée sur la bonne page de jeu.
